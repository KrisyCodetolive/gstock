<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// Point de santé (§12.7) : l'application répond et la base est joignable.
Route::get('/health', function () {
    try {
        DB::select('select 1');
        $database = 'ok';
    } catch (Throwable) {
        $database = 'down';
    }

    return response()->json(['status' => $database === 'ok' ? 'ok' : 'degraded', 'database' => $database], $database === 'ok' ? 200 : 503);
});
