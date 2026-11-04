<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Expenses\ExpenseService;
use App\Domain\Expenses\Models\Expense;
use App\Domain\Expenses\Models\ExpenseCategory;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\PurchasesPresenter;
use App\Support\Decimal as D;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Dépenses DP-N (M12) : liste filtrable par période et catégorie, enregistrement idempotent, annulation motivée. */
class ExpenseController extends Controller
{
    public function __construct(private ExpenseService $expenses) {}

    public function index(Request $request, Shop $shop): JsonResponse
    {
        $user = $request->user();
        $filter = (array) $request->query('filter', []);
        $base = Expense::query()->where('shop_id', $shop->id)
            ->when(! $user->hasAnyPermission('records.view_all'), fn ($q) => $q->where('user_id', $user->id))
            ->when(filled($filter['from'] ?? null), fn ($q) => $q->where('occurred_at', '>=', $filter['from']))
            ->when(filled($filter['to'] ?? null), fn ($q) => $q->where('occurred_at', '<=', $filter['to']))
            ->when(filled($filter['expense_category_id'] ?? null), fn ($q) => $q->where('expense_category_id', (int) $filter['expense_category_id']));
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $needle = '%'.addcslashes($search, '%_\\').'%';
            $base->where(fn ($q) => $q->where('reference', 'ilike', $needle)->orWhereRaw("unaccent(coalesce(note, '')) ILIKE unaccent(?)", [$needle])
                ->orWhereIn('expense_category_id', ExpenseCategory::query()->whereRaw('unaccent(name) ILIKE unaccent(?)', [$needle])->select('id')));
        }

        // Totaux par catégorie, hors dépenses annulées.
        $byCategory = (clone $base)->where('status', 'completed')->toBase()->groupBy('expense_category_id')
            ->selectRaw('expense_category_id, count(*) as n, sum(amount) as total')->get();
        $names = ExpenseCategory::query()->whereIn('id', $byCategory->pluck('expense_category_id'))->pluck('name', 'id');
        $total = $byCategory->reduce(fn ($s, $r) => D::add($s, (string) $r->total, D::MONEY), '0.00');

        return ListQuery::respond($request, $base->orderByDesc('occurred_at'), fn (Expense $e) => PurchasesPresenter::expense($e), filters: [
            'status' => fn (Builder $q, string $v) => $q->where('status', $v),
        ], extra: [
            'summary' => [
                'count' => (int) $byCategory->sum('n'),
                'total' => $total,
                'by_category' => $byCategory->sortByDesc(fn ($r) => (float) $r->total)->values()->map(fn ($r) => [
                    'category' => ['id' => (int) $r->expense_category_id, 'name' => $names[$r->expense_category_id] ?? ''],
                    'total' => D::format((string) $r->total, D::MONEY),
                ])->all(),
            ],
        ]);
    }

    public function store(Request $request, Shop $shop): JsonResponse
    {
        $expense = $this->expenses->record($shop, $request->user(), $request->all());

        return response()->json(['data' => PurchasesPresenter::expense($expense)], $expense->wasRecentlyCreated ? 201 : 200);
    }

    public function cancel(Request $request, Shop $shop, int $id): JsonResponse
    {
        $expense = $this->expenses->cancel(Expense::query()->where('shop_id', $shop->id)->findOrFail($id), $request->user(), $request->input('reason'));

        return response()->json(['data' => PurchasesPresenter::expense($expense)]);
    }
}
