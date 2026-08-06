---
name: fault-diagnosis
description: Diagnoses probable equipment failure modes by correlating anomaly scores, RUL estimates, alarm history, and equipment metadata against a curated historical fault-signature library, producing a ranked, evidence-backed list of candidate failure modes. Use when a technician, engineer, or the predictive maintenance workflow needs a diagnostic starting hypothesis for a specific piece of equipment before a work order or root-cause investigation is created.
---

# Fault Diagnosis

## Instructions

1. Retrieve the triggering anomaly score, contributing metrics, and any available RUL (remaining-useful-life) estimate for the equipment from `fact_failure_predictions`.
2. Pull the equipment's alarm history for the lookback window (default 7–30 days) and align alarm timestamps against the anomaly onset timeline.
3. Retrieve the fault-signature library entries applicable to the equipment's type/class (e.g., "Pump" signatures for centrifugal pumps).
4. Compute a similarity score between the observed multivariate pattern (metric direction, rate of change, co-occurring alarms) and each candidate fault signature.
5. Rank candidate failure modes by similarity-derived confidence; retain the top 2–4 candidates above the minimum match threshold (default 0.55, configurable).
6. For each candidate, extract and attach the specific supporting evidence (metric name, value, timestamp) that drove the match.
7. If no candidate exceeds the minimum match threshold, output an explicit "no strong historical match" result rather than forcing a low-confidence guess to the top.
8. Hand the ranked output to the Root Cause Analysis skill as input context for the next step in the diagnostic chain.

## Inputs

| Input | Source | Description |
|---|---|---|
| Composite anomaly score + contributing metrics | `fact_failure_predictions` | Which metric(s) are anomalous and by how much, over what window. |
| RUL estimate and confidence interval | `fact_failure_predictions` | Predicted remaining useful life and model confidence, if available for this equipment class. |
| Recent alarm history (last 7–30 days) | SQL Database `fact_alarms` | Alarm codes, severity, timing, correlated with anomaly onset. |
| Equipment metadata | SAP PM via `dim_equipment` | Equipment type, manufacturer, model, criticality class, functional location. |
| Historical fault-signature library | Curated reference set built from closed `fact_maintenance_history` records and OEM failure-mode taxonomies | Known metric-pattern-to-failure-mode mappings per equipment class. |

## Output Format

Return a JSON object with a ranked list of failure modes:

```json
{
  "equipment_id": "<string>",
  "ranked_failure_modes": [
    {"failure_mode": "<string>", "confidence": 0, "evidence": ["<string>", "..."]}
  ],
  "no_strong_match": false
}
```

- `ranked_failure_modes` contains 2–4 items ordered by descending confidence, unless `no_strong_match` is `true`, in which case it may be empty.
- `confidence` is an integer 0–100.
- `evidence` entries must be human-readable citations to actual retrieved data points (metric, value, timestamp, or alarm code).

## Examples

**Input (abridged):**
```json
{
  "equipment_id": "10004521",
  "anomaly_score": 0.86,
  "contributing_metrics": [
    {"metric": "Vibration_RMS_Velocity", "value": 4.22, "baseline": 1.05, "timestamp": "2026-07-24T22:00:00Z"},
    {"metric": "Bearing_Temp", "value": 53.1, "baseline": 42.3, "timestamp": "2026-07-24T22:00:00Z"}
  ],
  "recent_alarms": [{"alarm_code": "HIGH_TEMP", "severity": "High", "raised_at": "2026-07-06T12:28:00Z"}]
}
```

**Output:**
```json
{
  "equipment_id": "10004521",
  "ranked_failure_modes": [
    {"failure_mode": "Bearing wear - outer race defect", "confidence": 81, "evidence": ["Vibration RMS 4.22 mm/s vs baseline 1.05 mm/s (2026-07-24)", "Bearing temp +10.8C above baseline, sustained rising trend over 8 weeks", "HIGH_TEMP alarm raised 2026-07-06"]},
    {"failure_mode": "Lubrication degradation", "confidence": 42, "evidence": ["Gradual temperature rise without step-change pattern"]}
  ],
  "no_strong_match": false
}
```

## Guardrails

- Never present a single failure mode as certain; always retain at least a second-ranked alternative unless confidence exceeds 90% with multi-metric corroboration.
- Never fabricate a fault signature that is not present in the curated library — "no strong historical match" is a required, valid output.
- All evidence citations must reference actual retrieved data points (metric, value, timestamp) — no unsupported claims.
- This skill produces diagnostic input only; it must never recommend or trigger a repair action directly.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
