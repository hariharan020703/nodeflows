---
name: maintenance-planner
description: Converts a confirmed diagnosis and root-cause hypothesis into a concrete, resource- and parts-aware maintenance action plan — a recommended action window, crew assignment, and spare-parts status — that respects the equipment's existing SAP PM preventive maintenance calendar. Use when a confirmed failure risk needs to be turned into a planned, conflict-checked maintenance action rather than dispatched as ad hoc emergency work.
---

# Maintenance Planner

## Instructions

1. Determine the latest feasible start date for the action window, working backward from the predicted failure window close date with a safety margin (default: 25% of the window length or 24 hours, whichever is greater).
2. Query the existing SAP PM schedule for the equipment and any shared functional-location/crew dependencies within the candidate window.
3. If a conflict is found with an equal- or higher-priority already-scheduled order, do not silently override it; flag the conflict explicitly.
4. Query crew calendar for availability of technicians qualified for this equipment type within the candidate window.
5. Query SAP PM/MM parts stock status for the parts required by the diagnosed failure mode (mapped via a parts-to-failure-mode reference table); if not in stock, retrieve lead time/ETA.
6. If parts lead time would push the earliest feasible window past the predicted failure window close, surface this explicitly as an elevated-risk condition rather than silently picking an infeasible-but-clean-looking date.
7. Construct the recommended plan: action window, crew assignment suggestion, parts status, and any conflict/risk notes.
8. Pass the plan to the Maintenance Report Writer skill for notification/work-order drafting, pending Planner approval.

## Inputs

| Input | Source | Description |
|---|---|---|
| Confirmed failure mode and predicted failure window | Fault Diagnosis / Root Cause Analysis skill output, confirmed by Maintenance Engineer | What needs to be fixed and by when. |
| Existing PM schedule (next 30 days) | SAP PM (`IP10` maintenance plans, `IW3x` planned orders) | Already-scheduled work on this equipment and on shared crew/functional location peers. |
| Crew calendar | SAP PM / workforce scheduling system (next 14 days) | Technician/crew availability and skill qualification. |
| Spare parts stock status | SAP PM/MM stock check | Whether required parts are in stock, on order, or need to be sourced. |

## Output Format

```json
{
  "recommended_window_start": "<ISO-8601>",
  "recommended_window_end": "<ISO-8601>",
  "crew_assignment": "<string, by qualification/role, never a named individual>",
  "parts_status": "in_stock|on_order:<eta>|unknown",
  "conflict_notes": "<string>"
}
```

## Examples

**Input (abridged):**
```json
{
  "equipment_id": "10004521",
  "confirmed_failure_mode": "Bearing wear - outer race defect",
  "predicted_failure_window": {"start": "2026-08-06T00:00:00Z", "end": "2026-08-10T00:00:00Z"},
  "existing_pm_schedule": [{"order_no": "3000090", "type": "PM01", "window": "2026-08-09/2026-08-09", "priority": 3}],
  "parts_status_query": "bearing_kit_FT-CP-500"
}
```

**Output:**
```json
{
  "recommended_window_start": "2026-08-07T06:00:00Z",
  "recommended_window_end": "2026-08-07T14:00:00Z",
  "crew_assignment": "1x Mechanical Technician (Rotating Equipment qualified), 1x Helper",
  "parts_status": "on_order:2026-08-06",
  "conflict_notes": "No conflict with order 3000090 (different equipment, non-overlapping crew). Parts ETA 2026-08-06 leaves 1-day buffer before recommended window; monitor for delivery delay."
}
```

## Guardrails

- Must never autonomously reassign or cancel an existing higher- or equal-priority scheduled order; conflicts are surfaced for human resolution, not resolved silently.
- Must not represent a parts-status of `unknown` as `in_stock` or vice versa — an unresolved stock check must be reported as `unknown`, not guessed.
- Must explicitly flag when the recommended window falls after the predicted failure window closes, rather than presenting an infeasible plan as if it were safe.
- Crew assignment suggestions must be by qualification/role, not by naming a specific individual, preserving the Planner's staffing authority.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
