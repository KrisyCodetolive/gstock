<?php

namespace App\Domain\Stock;

use App\Domain\Audit\Audit;
use App\Domain\Catalog\Article;
use App\Domain\Catalog\Models\Product;
use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\Models\StockTransfer;
use App\Support\ApiException;
use App\Support\Decimal;
use App\Support\DocumentSequence;
use Illuminate\Support\Facades\DB;

/**
 * Transferts de stock entre boutiques d'un même espace (§7.12) : l'envoi sort le stock
 * de la boutique de départ (« en route »), la réception l'entre dans la boutique d'arrivée
 * pour la quantité reçue ; le manque est noté. Annulable seulement avant la réception.
 */
final class TransferService
{
    public function __construct(private StockLedger $ledger, private StockLots $lots) {}

    public function send(Shop $from, User $user, array $in): StockTransfer
    {
        if (! $user->hasAnyPermission('stock.transfer')) {
            throw ApiException::forbidden("Vous n'avez pas le droit de transférer du stock.");
        }
        $errors = [];
        $to = Shop::query()->find((int) ($in['to_shop_id'] ?? 0));
        if (! $to || ! $to->is_active) {
            $errors['to_shop_id'][] = 'Choisissez la boutique qui reçoit la marchandise.';
        } elseif ($to->id === $from->id) {
            $errors['to_shop_id'][] = 'Choisissez une autre boutique que celle de départ.';
        }
        $items = array_values((array) ($in['items'] ?? []));
        if (! $items) {
            $errors['items'][] = 'Ajoutez au moins un produit.';
        }
        $keys = array_map(fn ($i) => ((int) ($i['product_id'] ?? 0)).':'.($i['variant_id'] ?? ''), $items);
        if (count(array_unique($keys)) !== count($keys)) {
            $errors['items'][] = 'Un même produit apparaît deux fois.';
        }
        $products = Product::query()->with(['variants', 'unit'])->whereKey(array_map(fn ($i) => (int) ($i['product_id'] ?? 0), $items))->get()->keyBy('id');
        $lines = [];
        foreach ($items as $item) {
            $product = $products->get((int) ($item['product_id'] ?? 0));
            if (! $product || ! $product->isStockable() || ! $product->is_active) {
                $errors['items'][] = 'Un des produits ne peut pas être transféré.';

                continue;
            }
            try {
                $article = Article::resolve($product, $item['variant_id'] ?? null);
            } catch (ApiException $e) {
                $errors['items'][] = $e->errors['items'][0];

                continue;
            }
            $quantity = Decimal::parse($item['quantity'] ?? null);
            if ($quantity === null || Decimal::cmp($quantity, '0') <= 0) {
                $errors['items'][] = "Saisissez une quantité supérieure à 0 pour {$article->name()}.";

                continue;
            }
            $lines[] = [$article, Decimal::round($quantity, Decimal::QTY)];
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }
        $note = filled($in['note'] ?? null) ? mb_substr(trim((string) $in['note']), 0, 255) : null;

        return DB::transaction(function () use ($from, $to, $user, $lines, $note) {
            $reference = DocumentSequence::reference('TR');
            $transfer = StockTransfer::create([
                'from_shop_id' => $from->id, 'to_shop_id' => $to->id, 'reference' => $reference, 'status' => 'in_transit',
                'note' => $note, 'sent_at' => now(), 'sent_by' => $user->id,
            ]);
            foreach ($lines as [$article, $quantity]) {
                $transfer->items()->create([
                    'product_id' => $article->product->id, 'product_variant_id' => $article->variantId(),
                    'quantity' => $quantity, 'unit_cost' => $article->cost(),
                ]);
            }
            // Le stock sort tout de suite, jamais au-delà de ce qu'il y a (§7.2) ; dates les plus proches d'abord (§7.11).
            $this->ledger->apply(
                array_map(fn ($l) => new StockChange($from->id, $l[0]->product, $l[0]->variantId(), Decimal::neg($l[1])), $lines),
                ['source_type' => 'transfer_out', 'source_id' => $transfer->id, 'reference' => $reference, 'reason' => "Vers {$to->name}", 'user_id' => $user->id, 'occurred_at' => $transfer->sent_at],
            );
            Audit::record($user, 'transfer.sent', [
                'shop_id' => $from->id, 'subject' => $transfer, 'label' => $reference,
                'new' => [
                    'vers' => $to->name,
                    'produits' => array_map(fn ($l) => ['produit' => $l[0]->name(), 'quantite' => (float) $l[1]], $lines),
                ],
            ]);

            return $transfer;
        });
    }

    /**
     * Réception par la boutique d'arrivée : quantité reçue par ligne (par défaut, l'envoyée),
     * jamais plus. Chaque arrivage garde sa date ; un manque est pris sur les dates les plus lointaines.
     */
    public function receive(StockTransfer $transfer, Shop $shop, User $user, array $in): StockTransfer
    {
        if (! $user->hasAnyPermission('stock.entry')) {
            throw ApiException::forbidden("Vous n'avez pas le droit d'ajouter du stock.");
        }
        if ($transfer->to_shop_id !== $shop->id) {
            throw ApiException::forbidden('Seule la boutique qui reçoit la marchandise peut la réceptionner.');
        }

        return DB::transaction(function () use ($transfer, $shop, $user, $in) {
            $transfer = StockTransfer::query()->lockForUpdate()->with(['items.product.variants', 'items.product.unit', 'fromShop'])->findOrFail($transfer->id);
            if ($transfer->status !== 'in_transit') {
                throw ApiException::conflict($transfer->status === 'received' ? 'Ce transfert a déjà été réceptionné.' : 'Ce transfert a été annulé.');
            }
            $given = [];
            foreach ((array) ($in['items'] ?? []) as $row) {
                $given[((int) ($row['product_id'] ?? 0)).':'.($row['variant_id'] ?? '')] = $row['received_quantity'] ?? null;
            }
            $errors = [];
            $received = [];
            foreach ($transfer->items as $item) {
                $key = $item->product_id.':'.($item->product_variant_id ?? '');
                $sent = (string) $item->quantity;
                $value = array_key_exists($key, $given) ? Decimal::parse($given[$key]) : $sent;
                $name = $item->product->articleName($item->product_variant_id);
                if ($value === null || Decimal::cmp($value, '0') < 0) {
                    $errors['items'][] = "Saisissez la quantité reçue de {$name}.";
                } elseif (Decimal::cmp($value, $sent) > 0) {
                    $errors['items'][] = sprintf('Pour %s, la quantité reçue ne peut pas dépasser la quantité envoyée (%s).', $name, Decimal::human($sent));
                } else {
                    $received[$item->id] = Decimal::round($value, Decimal::QTY);
                }
            }
            if ($errors) {
                throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
            }

            $changes = [];
            foreach ($transfer->items as $item) {
                $left = $received[$item->id];
                if (Decimal::cmp($left, '0') <= 0) {
                    continue;
                }
                // Produit suivi : la quantité reçue reprend les dates parties, les plus proches d'abord (§7.11).
                $parts = $item->product->track_expiry
                    ? $this->lots->takenBy('transfer_out', $transfer->id, $transfer->from_shop_id, $item->product_id, $item->product_variant_id)
                    : [];
                foreach ($parts as $part) {
                    if (Decimal::cmp($left, '0') <= 0) {
                        break;
                    }
                    $take = Decimal::cmp($part['quantity'], $left) < 0 ? $part['quantity'] : $left;
                    $changes[] = new StockChange($shop->id, $item->product, $item->product_variant_id, $take, $part['unit_cost'] ?? ($item->unit_cost === null ? null : (string) $item->unit_cost), $part['expiry_date']);
                    $left = Decimal::sub($left, $take);
                }
                if (Decimal::cmp($left, '0') > 0) {
                    $changes[] = new StockChange($shop->id, $item->product, $item->product_variant_id, $left, $item->unit_cost === null ? null : (string) $item->unit_cost);
                }
            }
            $this->ledger->apply($changes, [
                'source_type' => 'transfer_in', 'source_id' => $transfer->id, 'reference' => $transfer->reference,
                'reason' => "Depuis {$transfer->fromShop->name}", 'user_id' => $user->id, 'occurred_at' => now(),
            ]);
            foreach ($transfer->items as $item) {
                $item->update(['received_quantity' => $received[$item->id]]);
            }
            $transfer->update([
                'status' => 'received', 'received_at' => now(), 'received_by' => $user->id,
                'reception_note' => filled($in['note'] ?? null) ? mb_substr(trim((string) $in['note']), 0, 255) : null,
            ]);
            $gaps = $transfer->items->filter(fn ($i) => Decimal::cmp($received[$i->id], (string) $i->quantity) < 0)
                ->map(fn ($i) => ['produit' => $i->product->articleName($i->product_variant_id), 'manque' => (float) Decimal::sub((string) $i->quantity, $received[$i->id])])
                ->values()->all();
            Audit::record($user, 'transfer.received', [
                'shop_id' => $shop->id, 'subject' => $transfer, 'label' => $transfer->reference,
                'new' => ['depuis' => $transfer->fromShop->name, ...($gaps ? ['manques' => $gaps] : [])],
            ]);

            return $transfer;
        });
    }

    /** Annulation avant réception, par la boutique de départ : la marchandise revient dans ses arrivages (ADR-012). */
    public function cancel(StockTransfer $transfer, Shop $shop, User $user, ?string $reason): StockTransfer
    {
        if (! $user->hasAnyPermission('stock.transfer')) {
            throw ApiException::forbidden("Vous n'avez pas le droit de transférer du stock.");
        }
        if ($transfer->from_shop_id !== $shop->id) {
            throw ApiException::forbidden('Seule la boutique qui a envoyé la marchandise peut annuler le transfert.');
        }
        $reason = trim((string) $reason);
        if ($reason === '') {
            throw ApiException::invalid('reason', 'Indiquez pourquoi vous annulez ce transfert.');
        }

        return DB::transaction(function () use ($transfer, $shop, $user, $reason) {
            $transfer = StockTransfer::query()->lockForUpdate()->with(['items.product.variants', 'items.product.unit'])->findOrFail($transfer->id);
            if ($transfer->status !== 'in_transit') {
                throw ApiException::conflict($transfer->status === 'received'
                    ? 'Ce transfert a déjà été réceptionné : corrigez par un transfert dans l’autre sens ou par un inventaire.'
                    : 'Ce transfert a déjà été annulé.');
            }
            $this->ledger->apply(
                $transfer->items->map(fn ($i) => new StockChange($shop->id, $i->product, $i->product_variant_id, (string) $i->quantity))->all(),
                ['source_type' => 'transfer_cancel', 'source_id' => $transfer->id, 'reference' => $transfer->reference, 'reason' => "Annulation : {$reason}", 'user_id' => $user->id],
            );
            $transfer->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $user->id, 'cancel_reason' => $reason]);
            Audit::record($user, 'transfer.cancelled', ['shop_id' => $shop->id, 'subject' => $transfer, 'label' => $transfer->reference, 'reason' => $reason]);

            return $transfer;
        });
    }
}
