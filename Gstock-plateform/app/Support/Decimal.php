<?php

namespace App\Support;

/**
 * Calcul décimal exact (bcmath) pour les quantités (3 décimales) et les montants
 * (2 décimales) : jamais de flottants sur l'argent ni sur le stock (§5.3, §8).
 */
final class Decimal
{
    public const QTY = 3;

    public const MONEY = 2;

    public static function add(string $a, string $b, int $scale = self::QTY): string
    {
        return bcadd(self::of($a), self::of($b), $scale);
    }

    public static function sub(string $a, string $b, int $scale = self::QTY): string
    {
        return bcsub(self::of($a), self::of($b), $scale);
    }

    public static function mul(string $a, string $b, int $scale = self::QTY): string
    {
        return self::round(bcmul(self::of($a), self::of($b), $scale + 4), $scale);
    }

    public static function cmp(string $a, string $b): int
    {
        return bccomp(self::of($a), self::of($b), 6);
    }

    public static function neg(string $a, int $scale = self::QTY): string
    {
        return bcmul(self::of($a), '-1', $scale);
    }

    /** Arrondi au plus proche (et non troncature comme bcmath). */
    public static function round(string $value, int $scale): string
    {
        $value = self::of($value);
        $offset = '0.'.str_repeat('0', $scale).'5';

        return str_starts_with($value, '-') ? bcsub($value, $offset, $scale) : bcadd($value, $offset, $scale);
    }

    /** Nombre saisi (« 12,5 », 12.5, null) → chaîne décimale, ou null si vide ou invalide. */
    public static function parse(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $s = str_replace([',', ' '], ['.', ''], trim((string) $value));

        return is_numeric($s) ? self::of($s) : null;
    }

    /** Format de l'API : « 12.000 » pour une quantité, « 1500.00 » pour un montant. */
    public static function format(?string $value, int $scale = self::QTY): ?string
    {
        return $value === null ? null : bcadd(self::of($value), '0', $scale);
    }

    /** Écriture lisible en français : « 12 », « 2,5 ». */
    public static function human(string $value): string
    {
        $s = rtrim(rtrim(bcadd(self::of($value), '0', self::QTY), '0'), '.');

        return str_replace('.', ',', $s === '-0' ? '0' : $s);
    }

    private static function of(string|int|float $v): string
    {
        $s = is_float($v) ? sprintf('%.6F', $v) : (string) $v;

        return is_numeric($s) ? (str_contains($s, 'e') || str_contains($s, 'E') ? sprintf('%.6F', (float) $s) : $s) : '0';
    }
}
