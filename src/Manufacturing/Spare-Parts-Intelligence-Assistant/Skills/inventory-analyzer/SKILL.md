---
name: inventory-analyzer
description: Computes criticality-weighted safety stock, reorder points, and min/max stocking bands for a spare part, and flags stock-out risk or overstock/slow-moving positions with a quantified dollar carrying-cost exposure. Use when a planner needs a defensible stocking policy for a material/plant, or when a demand forecast needs to be converted into a concrete reorder point and min/max recommendation.
---

# Inventory Analyzer

## Instructions

1. **Apply criticality weighting.** Map the material's `criticality_class` to a target service level and criticality multiplier:
   - Class A (safety-relevant or single-point-of-failure equipment): target service level 98%, multiplier 1.5x.
   - Class B (important, some slack/redundancy): target service level 95%, multiplier 1.2x.
   - Class C (low-criticality/consumable): target service level 90%, multiplier 1.0x.
   If criticality class is missing, default to Class B and flag the assumption.
2. **Compute safety stock:** `Safety Stock = Z(service_level) x sigma_demand_during_lead_time x criticality_multiplier`, where `sigma_demand_during_lead_time` is the standard deviation of the material's monthly consumption scaled to `lead_time_days`, and `Z` is the standard normal deviate for the target service level (2.05 for 98%, 1.65 for 95%, 1.28 for 90%).
3. **Compute reorder point:** `Reorder Point = (average daily demand x lead_time_days) + Safety Stock`.
4. **Compute the min/max band.** `Min = Reorder Point` (rounded up to the next practical order multiple). `Max = Min + one forecasted order cycle's worth of demand` (typically the 3-month forecast, bounded so Max never implies more than ~6 months of cover for Class C).
5. **Check current position.** Compare current on-hand plus open orders against the newly computed reorder point. If below it, set `stock_out_risk = true` with days-of-cover remaining.
6. **Check for overstock/slow-movers.** Flag any material where on-hand exceeds the computed Max by more than 25% and trailing-12-month consumption is below a low-velocity threshold (e.g. under 4 units/year for discrete parts).
7. **Quantify carrying cost.** For every overstock flag, compute `on_hand_value_above_max x carrying_cost_rate` (default 22%/year) so the recommendation is expressed in dollars, not just units.
8. **Package the result** for downstream use by the cost-optimization skill and for planner review, including the trailing consumption trend alongside any overstock flag so a planner can distinguish excess buffer from an obsolete/superseded part.

## Inputs

- `material_id`, `plant`, `on_hand_qty`, `as_of_date` — required.
- Demand forecast (from the spare-recommendation skill): 1/3/12-month forecast, prediction interval, model used.
- Spare part master: `criticality_class`, `min_stock`, `max_stock`, `lead_time_days`, `unit_cost_usd`.
- Consumption history: used to compute consumption variability (standard deviation).

## Output Format

Return a JSON object with: `material_id`, `plant`, `criticality_class`, `computed_reorder_point`, `computed_min_max`, `current_on_hand`, `flag` (`stock_out_risk` | `overstock` | none), relevant quantified exposure field (`days_of_cover_remaining` or `annualized_carrying_cost_exposure_usd` plus `overstock_units_above_max`), `trailing_12mo_consumption_units`, and `rationale`.

## Examples

**Input:**
```json
{
  "material_id": "SP-GASKET-FLNG-DN50",
  "plant": "PLANT-B",
  "on_hand_qty": 96,
  "as_of_date": "2026-08-04"
}
```

**Output:**
```json
{
  "material_id": "SP-GASKET-FLNG-DN50",
  "plant": "PLANT-B",
  "criticality_class": "C",
  "computed_reorder_point": 22,
  "computed_min_max": {"min": 25, "max": 60},
  "current_on_hand": 96,
  "flag": "overstock",
  "overstock_units_above_max": 36,
  "annualized_carrying_cost_exposure_usd": 30.50,
  "trailing_12mo_consumption_units": 23,
  "rationale": "On-hand (96) exceeds the computed max (60) by 36 units, a 60% overage. Trailing-12-month consumption of 23 units/year is stable, not trending up (source: fact_consumption, 4 work orders across 2025-2026). At $3.85/unit and a 22% carrying cost rate, the excess 36 units represent roughly $30.50/year in avoidable carrying cost, plus shelf space. Recommend halting reorders until on-hand falls below 60, and consider a partial return to vendor if the supplier agreement allows."
}
```

## Guardrails

- Never recommend a Min/Max change for Class A materials below the computed safety-stock floor, even under cost-optimization pressure — criticality-driven service levels take precedence over carrying-cost minimization for safety-relevant parts.
- Always show the trailing consumption trend alongside an overstock flag so a planner can catch a leading indicator of an obsolete/superseded part rather than simple excess buffer.
- Log every computed parameter (Z-value, criticality multiplier, carrying cost rate) with the recommendation so the calculation is fully auditable and reproducible, never a black box.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
