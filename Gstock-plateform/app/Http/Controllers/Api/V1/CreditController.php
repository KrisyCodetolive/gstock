<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Credits\CreditLedger;
use App\Domain\Credits\CreditService;
use App\Domain\Credits\InstallmentSchedule;
use App\Domain\Credits\Models\CreditRepayment;
use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Credits\Models\CustomerRefund;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\CreditsPresenter;
use App\Http\Resources\SalesPresenter;
use App\Support\Decimal as D;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/** Mes crédits clients (M09) : cartes, débiteurs, crédits, fiche client, anciennes dettes, annulation, régularisation, échéances. */
class CreditController extends Controller
{
    public function __construct(private CreditService $credits, private CreditLedger $ledger, private CreditsPresenter $present) {}

    /** Cartes : reste à récupérer, débiteurs, nouveaux crédits et paiements reçus sur la période, échéances en retard. */
    public function summary(Request $request, Shop $shop): JsonResponse
    {
        $user = $request->user();
        [$from, $to] = $this->period($request);
        $open = CustomerCredit::query()->where('shop_id', $shop->id)->where('status', '!=', 'cancelled')->where('remaining_amount', '>', 0)->get();
        $newCredits = $this->own($user, CustomerCredit::query()->where('shop_id', $shop->id)->where('status', '!=', 'cancelled')->where('is_opening_balance', false))
            ->when($from, fn ($q) => $q->where('occurred_at', '>=', $from))->when($to, fn ($q) => $q->where('occurred_at', '<=', $to));
        // Argent reçu sur des crédits : paiements confirmés, hors avoir (§7.8).
        $repayments = $this->own($user, CreditRepayment::query()->where('shop_id', $shop->id)->where('status', 'completed')->whereNotNull('payment_method_id'))
            ->when($from, fn ($q) => $q->where('received_at', '>=', $from))->when($to, fn ($q) => $q->where('received_at', '<=', $to));
        $overdue = $open->flatMap(fn ($c) => InstallmentSchedule::of('customer_credit', $c->id, (string) $c->remaining_amount))->where('status', 'overdue');

        return response()->json(['data' => [
            'remaining_total' => D::format((string) $open->sum('remaining_amount'), D::MONEY),
            'debtors_count' => $open->pluck('customer_id')->unique()->count(),
            'new_credits' => ['count' => (clone $newCredits)->count(), 'amount' => D::format((string) ((clone $newCredits)->sum('amount') ?: '0'), D::MONEY)],
            'repayments' => ['count' => (clone $repayments)->count(), 'amount' => D::format((string) ((clone $repayments)->sum('amount') ?: '0'), D::MONEY)],
            'overdue_installments' => [
                'count' => $overdue->count(),
                'amount' => D::format((string) $overdue->sum(fn ($i) => (float) D::sub($i['amount'], $i['paid_amount'], D::MONEY)), D::MONEY),
            ],
        ]]);
    }

    /** Une ligne par client qui doit de l'argent dans la boutique, du plus gros solde au plus petit. */
    public function debtors(Request $request, Shop $shop): JsonResponse
    {
        $credits = DB::table('customer_credits')->where('shop_id', $shop->id)->where('status', '!=', 'cancelled')
            ->groupBy('customer_id')
            ->selectRaw('customer_id, sum(amount) as credit_total, sum(remaining_amount) as balance, count(*) filter (where remaining_amount > 0) as open_credits, max(occurred_at) as last_credit_at');
        $repaid = "(select coalesce(sum(a.amount), 0) from credit_repayment_allocations a join credit_repayments r on r.id = a.credit_repayment_id
            join customer_credits c on c.id = a.customer_credit_id where r.status = 'completed' and c.status != 'cancelled' and c.shop_id = {$shop->id} and c.customer_id = customers.id)";
        $lastRepayment = "(select max(received_at) from credit_repayments r where r.status != 'cancelled' and r.shop_id = {$shop->id} and r.customer_id = customers.id)";
        $notes = null;

        return ListQuery::respond(
            $request,
            Customer::query()->joinSub($credits, 'd', 'd.customer_id', '=', 'customers.id')->where('d.balance', '>', 0)
                ->select('customers.*', 'd.credit_total', 'd.balance', 'd.open_credits', 'd.last_credit_at')
                ->selectRaw("{$repaid} as repaid_total, {$lastRepayment} as last_repayment_at")
                ->orderByDesc('d.balance'),
            function (Customer $c) use (&$notes) {
                $last = collect([$c->last_credit_at, $c->last_repayment_at])->filter()->max();

                return [
                    'customer' => ['id' => $c->id, 'name' => $c->name, 'phone' => $c->phone],
                    'credit_total' => D::format((string) $c->credit_total, D::MONEY),
                    'repaid_total' => D::format((string) $c->repaid_total, D::MONEY),
                    'balance' => D::format((string) $c->balance, D::MONEY),
                    'open_credits' => (int) $c->open_credits,
                    'last_operation_at' => $last ? now()->parse($last)->toIso8601String() : null,
                    'credit_note_balance' => D::format((string) ($notes[$c->id] ?? '0'), D::MONEY),
                ];
            },
            searchIn: ['customers.name', 'customers.phone'],
            beforeMap: function ($items) use (&$notes, $shop) {
                $notes = $this->ledger->creditNoteBalances($items->pluck('id')->all(), [$shop->id]);
            },
        );
    }

    /** Liste des crédits (« Nouveaux crédits »), du plus récent au plus ancien. */
    public function index(Request $request, Shop $shop): JsonResponse
    {
        [$from, $to] = $this->period($request);
        $query = $this->own($request->user(), CustomerCredit::query()->where('shop_id', $shop->id))
            ->when($from, fn ($q) => $q->where('occurred_at', '>=', $from))->when($to, fn ($q) => $q->where('occurred_at', '<=', $to))
            ->with(['customer', 'shop', 'sale'])->orderByDesc('occurred_at')->orderByDesc('id');
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $needle = '%'.addcslashes($search, '%_\\').'%';
            $query->where(fn ($w) => $w->where('reference', 'ilike', $needle)
                ->orWhereIn('customer_id', Customer::query()->whereRaw('unaccent(name) ILIKE unaccent(?)', [$needle])->select('id')));
        }

        return ListQuery::respond($request, $query, fn (CustomerCredit $c) => $this->present->listItem($c), filters: [
            'status' => fn (Builder $q, string $v) => $q->where('status', $v),
            'customer_id' => fn (Builder $q, string $v) => $q->where('customer_id', (int) $v),
        ]);
    }

    /** Fiche crédit d'un client, sur les boutiques accessibles. */
    public function customerFile(Request $request, Customer $customer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $shops = $user->isOwner() ? Shop::query()->orderBy('id')->get() : $user->shops()->orderBy('shops.id')->get();
        $shopIds = $shops->pluck('id')->all();
        $credits = CustomerCredit::query()->where('customer_id', $customer->id)->whereIn('shop_id', $shopIds)->orderByDesc('occurred_at')->orderByDesc('id')->get();
        $live = $credits->where('status', '!=', 'cancelled');

        return response()->json(['data' => [
            'customer' => ['id' => $customer->id, 'name' => $customer->name, 'phone' => $customer->phone, 'district' => $customer->district],
            'totals' => [
                'credit_total' => D::format((string) $live->sum('amount'), D::MONEY),
                'repaid_total' => D::format((string) $live->sum(fn ($c) => (float) $this->ledger->repaid($c->id)), D::MONEY),
                'balance' => D::format((string) $live->sum('remaining_amount'), D::MONEY),
            ],
            'balances' => $shops->map(fn ($s) => ['shop' => ['id' => $s->id, 'name' => $s->name], 'balance' => D::format(SalesPresenter::balance($customer->id, [$s->id]), D::MONEY)])->values(),
            'credit_note_balance' => $this->ledger->creditNoteBalance($customer->id, $shopIds),
            'credits' => $credits->map(fn ($c) => $this->present->credit($c))->values(),
            'repayments' => CreditRepayment::query()->where('customer_id', $customer->id)->whereIn('shop_id', $shopIds)
                ->orderByDesc('received_at')->orderByDesc('id')->get()->map(fn ($r) => $this->present->repayment($r))->values(),
            'refunds' => CustomerRefund::query()->where('customer_id', $customer->id)->whereIn('shop_id', $shopIds)
                ->orderBy('id')->get()->map(fn ($r) => $this->present->refund($r))->values(),
        ]]);
    }

    /** Ancienne dette saisie sans vente (CR-N). */
    public function openingBalance(Request $request, Shop $shop): JsonResponse
    {
        return response()->json(['data' => $this->present->credit($this->credits->openingBalance($shop, $request->user(), $request->all()))], 201);
    }

    public function cancel(Request $request, Shop $shop, int $id): JsonResponse
    {
        $credit = CustomerCredit::query()->where('shop_id', $shop->id)->findOrFail($id);
        $credit = $this->credits->cancel($credit, $request->user(), $request->input('reason'), $request->only(['refund_mode', 'refund_payment_method_id']));

        return response()->json(['data' => $this->present->credit($credit->fresh())]);
    }

    public function adjust(Request $request, Shop $shop, int $id): JsonResponse
    {
        $credit = CustomerCredit::query()->where('shop_id', $shop->id)->findOrFail($id);

        return response()->json(['data' => $this->present->credit($this->credits->adjust($credit, $request->user(), $request->input('amount'), $request->input('reason'))->fresh())]);
    }

    public function installments(Shop $shop, int $id): JsonResponse
    {
        $credit = CustomerCredit::query()->where('shop_id', $shop->id)->findOrFail($id);

        return response()->json(['data' => $this->present->credit($credit)['installments']]);
    }

    public function setInstallments(Request $request, Shop $shop, int $id): JsonResponse
    {
        $credit = CustomerCredit::query()->where('shop_id', $shop->id)->findOrFail($id);

        return response()->json(['data' => $this->present->credit($this->credits->setInstallments($credit, (array) $request->input('installments', []))->fresh())]);
    }

    /** Échéances de la boutique : en retard, à venir (7 jours), ou toutes celles non payées. */
    public function allInstallments(Request $request, Shop $shop): JsonResponse
    {
        $status = $request->query('status');
        $week = now()->addDays(7)->toDateString();
        $search = mb_strtolower(trim((string) $request->query('search', '')));
        $rows = CustomerCredit::query()->with('customer')->where('shop_id', $shop->id)->where('status', '!=', 'cancelled')->get()
            ->flatMap(fn (CustomerCredit $c) => array_map(fn ($i) => [
                ...$i,
                'credit' => ['id' => $c->id, 'reference' => $c->reference],
                'customer' => ['id' => $c->customer->id, 'name' => $c->customer->name, 'phone' => $c->customer->phone],
            ], InstallmentSchedule::of('customer_credit', $c->id, (string) $c->remaining_amount)))
            ->filter(fn ($i) => match ($status) {
                'overdue' => $i['status'] === 'overdue',
                'upcoming' => ! in_array($i['status'], ['paid', 'overdue'], true) && $i['due_date'] <= $week,
                default => $i['status'] !== 'paid',
            })
            ->filter(fn ($i) => $search === '' || str_contains(mb_strtolower($i['customer']['name']), $search))
            ->sortBy('due_date')->values();
        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));
        $pageNo = max(1, (int) $request->query('page', 1));
        $page = new LengthAwarePaginator($rows->forPage($pageNo, $perPage)->values(), $rows->count(), $perPage, $pageNo);

        return response()->json(['data' => $page->items(), 'meta' => [
            'current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage(),
        ]]);
    }

    /** @return array{0: ?string, 1: ?string} période `from`/`to` (ou `filter[from]`/`filter[to]`) */
    private function period(Request $request): array
    {
        return [$request->query('from') ?? $request->input('filter.from'), $request->query('to') ?? $request->input('filter.to')];
    }

    /** Sans `records.view_all`, on ne voit que ses propres opérations (§6.2). */
    private function own(User $user, Builder $query): Builder
    {
        return $query->when(! $user->hasAnyPermission('records.view_all'), fn ($q) => $q->where('user_id', $user->id));
    }
}
