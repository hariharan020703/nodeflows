---
name: spare-recommendation
description: Forecasts forward spare-part consumption for a given material and plant and recommends whether stocking parameters (min/max, reorder point) should change, before a stock-out or overstock condition materializes. Use when a planner, maintenance engineer, or an upstream skill needs a demand forecast for a spare part, or needs to know whether current SAP MM min/max/reorder-point settings are still appropriate given recent consumption trends.
---

# Spare Recommendation

## Instructions

1. **Assemble data.** Pull 12-24 months of consumption history (`fact_consumption`) for the target `material_id`/`plant`, join to the spare part master (`dim_spare_part`) for criticality class and current min/max, and pull the latest on-hand stock position.
2. **Clean the series.** Exclude any record flagged `data_quality_flag = true` (implausible negative or outlier quantities). Aggregate to a monthly consumption series per material/plant.
3. **Select a forecasting model** based on data volume and criticality:
   - Low-volume, intermittent-demand parts (most Class A capital spares, e.g. gearboxes, motors): use a weighted moving average with a manual seasonality override — classical time-series models overfit sparse series.
   - Moderate-volume, regular-cadence consumables (filters, grease, fuses): use Holt-Winters exponential smoothing to capture trend and seasonality.
   - Parts with an available upstream failure-prediction signal (from the Predictive Maintenance Assistant): use a gradient-boosted regressor (LightGBM) trained on lagged consumption features plus the failure probability/RUL estimate as an exogenous feature, so a predicted failure spike shifts the forecast ahead of the historical trend catching up.
4. **Generate the forecast.** Produce a point forecast and an 80% prediction interval for the next 1, 3, and 12 months of consumption.
5. **Apply the production-plan adjustment.** Scale consumables' forecasts proportionally to planned run-hours where an ERP-sourced Line-level ramp-up or ramp-down is scheduled.
6. **Derive a stocking recommendation.** Convert the demand forecast, `lead_time_days`, and criticality class into a recommended safety stock, reorder point, and min/max band (delegate the detailed calculation to the inventory-analyzer skill).
7. **Write the rationale.** State the forecast numbers, model used, confidence interval, and any triggering signals in plain language, citing the specific source records used. Never state a rationale not traceable to the pulled dataset.
8. **Check materiality and log.** Compare the new recommendation to the current SAP MM min/max. If the delta exceeds ±20% (configurable), flag for planner review. Otherwise, log it as an FYI-level recommendation.

## Inputs

- `material_id`, `plant` — required.
- `forecast_horizon_months` — optional, defaults to producing 1/3/12-month forecasts.
- `as_of_date` — optional, defaults to current date.
- Consumption history, spare part master, and current stock position (from the inventory-database and sap-mm connectors).
- Upstream failure-prediction signal (optional, from the Predictive Maintenance Assistant).
- ERP production plan (optional adjustment covariate).

## Output Format

Return a JSON object with: `material_id`, `plant`, `model_used`, `forecast_next_3_months_units`, `prediction_interval_80pct`, `current_min_max`, `recommended_min_max`, `delta_vs_current`, `rationale` (plain-language, source-cited), and `flag_for_review` (boolean).

## Examples

**Input:**
```json
{
  "material_id": "SP-BRG-6205-2RS",
  "plant": "PLANT-A",
  "forecast_horizon_months": 3,
  "as_of_date": "2026-08-04"
}
```

**Output:**
```json
{
  "material_id": "SP-BRG-6205-2RS",
  "plant": "PLANT-A",
  "model_used": "Holt-Winters exponential smoothing (trend+seasonal), 18-month history",
  "forecast_next_3_months_units": 11,
  "prediction_interval_80pct": [8, 15],
  "current_min_max": {"min": 8, "max": 24},
  "recommended_min_max": {"min": 10, "max": 28},
  "delta_vs_current": "+25% min, +17% max",
  "rationale": "Consumption on SP-BRG-6205-2RS at PLANT-A has trended upward from 3 units/quarter in early 2025 to 4-5 units/quarter by mid-2026 (source: fact_consumption, 6 work orders over 18 months, most recently WO-2026-00251 on 2026-06-20). At a 10-day lead time and Class A criticality, the current min of 8 leaves under 3 weeks of cover at the latest consumption rate. Recommend raising min to 10 and max to 28 to preserve a full lead-time-plus-buffer cushion.",
  "flag_for_review": true
}
```

## Guardrails

- Never recommend a stocking change for a material with fewer than 3 historical consumption events without explicitly labeling the recommendation "low-confidence — insufficient history."
- Never silently override the SAP MM min/max — every recommendation is logged, and any recommendation above the materiality threshold requires planner sign-off before write-back.
- Every rationale must cite the specific consumption/work-order records used; never state a forecast rationale not traceable to the pulled dataset.
- Exclude data-quality-flagged consumption records from model training and say so explicitly when it materially affects the forecast.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
