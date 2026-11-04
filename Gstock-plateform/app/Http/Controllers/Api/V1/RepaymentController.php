<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Credits\InstallmentSchedule;
use App\Domain\Credits\Models\CreditRepayment;
use App\Domain\Credits\RepaymentService;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Sales\ReceiptLinks;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\CreditsPresenter;
use App\Http\Resources\SalesPresenter;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Paiements de crédit RB-N (M09) : enregistrement, liste, annulation motivée, reçus. */
class RepaymentController extends Controller
{
    public function __construct(private RepaymentService $repayments, private CreditsPresenter $present, private ReceiptLinks $links) {}

    public function store(Request $request, Shop $shop): JsonResponse
    {
        $repayment = $this->repayments->record($shop, $request->user(), $request->all());

        return response()->json(['data' => $this->present->repayment($repayment->fresh())], $repayment->wasRecentlyCreated ? 201 : 200);
    }

    public function index(Request $request, Shop $shop): JsonResponse
    {
        $from = $request->query('from') ?? $request->input('filter.from');
        $to = $request->query('to') ?? $request->input('filter.to');
        $search = trim((string) $request->query('search', ''));
        $query = $this->visible($request->user(), $shop)
            ->when($from, fn ($q) => $q->where('received_at', '>=', $from))->when($to, fn ($q) => $q->where('received_at', '<=', $to))
            ->when($search !== '', function ($q) use ($search) {
                $needle = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn ($w) => $w->where('reference', 'ilike', $needle)
                    ->orWhereIn('customer_id', Customer::query()->whereRaw('unaccent(name) ILIKE unaccent(?)', [$needle])->select('id')));
            })
            ->orderByDesc('received_at')->orderByDesc('id');

        return ListQuery::respond($request, $query, fn (CreditRepayment $r) => $this->present->repayment($r), filters: [
            'customer_id' => fn (Builder $q, string $v) => $q->where('customer_id', (int) $v),
            'status' => fn (Builder $q, string $v) => $q->where('status', $v),
        ]);
    }

    public function show(Request $request, Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => $this->present->repayment($this->visible($request->user(), $shop)->findOrFail($id))]);
    }

    public function cancel(Request $request, Shop $shop, int $id): JsonResponse
    {
        $repayment = CreditRepayment::query()->where('shop_id', $shop->id)->findOrFail($id);

        return response()->json(['data' => $this->present->repayment($this->repayments->cancel($repayment, $request->user(), $request->input('reason'))->fresh())]);
    }

    public function receipt(Request $request, Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => $this->present->receipt($this->visible($request->user(), $shop)->findOrFail($id))]);
    }

    /** Lien de reçu à partager sur WhatsApp : signé, valable 7 jours (ADR-013). */
    public function shareLink(Request $request, Shop $shop, int $id): JsonResponse
    {
        $r = $this->visible($request->user(), $shop)->findOrFail($id);
        ['token' => $token, 'expires_at' => $exp] = $this->links->sign('r', $shop->id, $r->id);
        $tenant = CurrentTenant::get();
        $url = str_replace('{tenant}', $tenant->slug, config('gstock.frontend_url')).'/recu/'.$token;
        $rest = SalesPresenter::balance($r->customer_id, [$shop->id]);

        return response()->json(['data' => [
            'url' => $url,
            'expires_at' => $exp->toIso8601String(),
            'message' => sprintf('Bonjour, merci pour votre paiement de %s FCFA à %s (reçu %s). Reste à payer : %s FCFA. %s',
                InstallmentSchedule::fr((string) $r->amount), $tenant->name, $r->reference, InstallmentSchedule::fr($rest), $url),
        ]]);
    }

    /** Sans `records.view_all`, on ne voit que ses propres paiements (§6.2). */
    private function visible(User $user, Shop $shop): Builder
    {
        return CreditRepayment::query()->where('shop_id', $shop->id)
            ->when(! $user->hasAnyPermission('records.view_all'), fn ($q) => $q->where('user_id', $user->id));
    }
}
