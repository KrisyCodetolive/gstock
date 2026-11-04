<?php

namespace App\Support;

/** Numéros ivoiriens : `07 00 00 00 01` ou `+225 0700000001` → `0700000001`. */
final class Phone
{
    public static function normalize(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        $digits = preg_replace('/[\s.\-]/', '', trim($value));

        return preg_replace('/^\+225/', '', $digits);
    }
}
