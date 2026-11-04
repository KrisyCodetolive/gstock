<?php

namespace Tests\Unit;

use App\Domain\Catalog\Models\Unit;
use PHPUnit\Framework\TestCase;

/** Conversion en unité de base (§7.3) : Carton = Unité × 12, Gramme = Kilogramme ÷ 1000. */
class UnitFactorTest extends TestCase
{
    public function test_a_base_unit_counts_for_one(): void
    {
        $this->assertSame('1', (new Unit(['name' => 'Unité', 'short_name' => 'u']))->factor());
    }

    public function test_a_multiplied_unit_contains_several_base_units(): void
    {
        $carton = new Unit(['base_unit_id' => 1, 'operator' => '*', 'operator_value' => '12']);
        $this->assertSame(12.0, (float) $carton->factor());
    }

    public function test_a_divided_unit_is_a_fraction_of_the_base_unit(): void
    {
        $gram = new Unit(['base_unit_id' => 6, 'operator' => '/', 'operator_value' => '1000']);
        $this->assertSame('0.001000', $gram->factor());
    }
}
