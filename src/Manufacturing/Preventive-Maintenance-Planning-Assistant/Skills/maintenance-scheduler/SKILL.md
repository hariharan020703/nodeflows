---
name: maintenance-scheduler
description: Generates optimized preventive maintenance (PM) schedules for a plant, line, or asset class by solving a constraint-optimization problem across OEM-recommended service intervals, current machine runtime, production plan commitments, and historical schedule-compliance patterns. Use when a maintenance planner requests a candidate PM schedule for a rolling horizon (e.g., next quarter), or when the Resource Planner, Checklist Generator, or Calendar Optimizer skills need an upstream candidate schedule to enrich and publish.
---

# Maintenance Scheduler

This is the core scheduling engine of the Preventive Maintenance Planning Assistant — it produces the candidate schedule that the Resource Planner, Checklist Generator, and Calendar Optimizer skills then enrich and publish.

## Instructions

1. **Pull due-list candidates.** Query equipment runtime data (`dim_equipment` joined to the latest completed PM per asset) and compute `hours_since_last_service = run_hours_total − run_hours_at_last_service` and `interval_utilization = hours_since_last_service / oem_service_interval_hours`. Flag any asset at or above an 85% utilization threshold as "due within horizon," and any asset already at ≥100% as "overdue" (hard constraint — must be scheduled first, and flagged as a compliance risk if it cannot fit).
2. **Estimate runtime velocity.** Using the production plan's `planned_qty` and historical run-hour accrual rate per line, project forward the date each due/near-due asset will cross its OEM interval, giving each candidate task a target completion window rather than a single date.
3. **Build the constraint model.** Formulate a constraint-programming model (OR-Tools CP-SAT style) where each PM task is a variable with domain = eligible calendar days in the horizon:
   - **Hard constraints:** task cannot be scheduled during a Plant Calendar shutdown/blackout day; task cannot be scheduled during an ERP production-plan window that reserves the asset's line for a committed run unless the task is a designated "run-time" task (lubrication, inspection) explicitly allowed during production; task must complete before the OEM interval is exceeded (overdue assets pinned to the earliest feasible slot); no two tasks requiring the same certified technician skill may double-book that technician's day (pre-filtered here at the aggregate capacity level; confirmed later by the Resource Planner skill).
   - **Soft constraints (objective weights):** minimize deviation from the historically observed best-compliance day-of-week/shift for that asset class; smooth workload across the horizon to avoid clustering (penalize weeks where scheduled PM hours exceed 80% of available technician-hours); prefer batching multiple PM tasks on the same asset or co-located assets on the same visit to reduce line-access downtime; penalize scheduling a task on a date with a historically high "Skipped – Production Conflict" or "Rescheduled" rate for that line.
4. **Solve.** Run the CP-SAT (or equivalent heuristic/genetic solver for horizons above roughly 500 tasks) to minimize the weighted sum of soft-constraint penalties subject to all hard constraints. Cap solver time at the configured time budget; if no feasible solution is found within budget, relax soft constraints in this priority order — workload smoothing first, then day-of-week preference — and re-solve.
5. **Score and annotate.** For each scheduled task, attach a machine-readable rationale trace (which constraints bound the choice, e.g., "earliest feasible slot after Line 2 production freeze ends Aug 18; OEM interval breach otherwise on Aug 22") for downstream plain-language explanation.
6. **Return the proposed schedule** as a structured task list (equipment, task type, proposed date range, priority, rationale trace) for downstream enrichment by the Resource Planner (technician assignment) and Calendar Optimizer (final calendar placement) skills.

## Inputs

| Input | Source | Fields Used |
|---|---|---|
| Equipment runtime & service intervals | SQL Database (`dim_equipment`) / SAP PM Maintenance Plan (IP10) | `equipment_id`, `run_hours_total`, `oem_service_interval_hours`, `last_service_date`, `criticality` |
| Production plan / plant calendar | ERP connector (`erp_production_plan`, Plant Calendar) | `line`, `planned_start`, `planned_end`, `planned_qty`, blackout/shutdown dates |
| PM schedule history | SQL Database (`fact_maintenance_history`) / SAP PM Order history | `plan_id`, `equipment_id`, `planned_date`, `completed_date`, `status`, `variance_days` |
| Planning horizon & policy parameters | User request or plugin configuration | horizon length (e.g., next quarter), interval-utilization threshold, blackout buffer days |

## Output Format

Return a structured PM task list, one entry per scheduled task:

```json
{
  "plan_id": "PM-20401",
  "equipment_id": "EQ-10088",
  "task_type": "Bearing Lubrication & Seal Inspection (2000-hr interval)",
  "proposed_date": "2026-08-19",
  "priority": "High",
  "interval_utilization_at_schedule": 0.97,
  "constraint_rationale": "Line 1 committed production run occupies Aug 10-17 (hard constraint). Interval reaches 100% utilization by Aug 24 at current runtime velocity. Earliest feasible post-freeze slot with certified Rotating Equipment technician availability is Aug 19."
}
```

Also produce:
- Schedule-level KPIs: projected schedule compliance %, number of overdue assets resolved, number of soft-constraint violations accepted (with reason).
- A conflict/exception report: assets that could not be scheduled within the horizon without breaching a hard constraint, routed to the Maintenance Engineer/Planner for manual override.

## Examples

**Input (excerpt):**
```json
{
  "equipment_id": "EQ-10088",
  "run_hours_total": 22140,
  "oem_service_interval_hours": 2000,
  "last_service_date": "2026-07-01",
  "line": "LINE1",
  "criticality": "High",
  "production_plan_window": {"line": "LINE1", "planned_start": "2026-08-10", "planned_end": "2026-08-17"}
}
```

**Output:** see the Output Format example above (`PM-20401`).

## Guardrails

- Never auto-schedule an overdue safety-critical asset (criticality = Critical) past its OEM interval without an explicit human override logged with a named approver and reason code.
- Never silently drop a due asset from the schedule; every asset above the utilization threshold must appear either as scheduled or in the exception report.
- Do not schedule PM against a hard-constraint production window even under solver relaxation — production-freeze windows are never relaxed automatically; only a Planner can override with documented business justification.
- Every rationale trace must cite the specific source record/field (e.g., production plan ID, interval value) — never produce an unattributed scheduling decision.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
