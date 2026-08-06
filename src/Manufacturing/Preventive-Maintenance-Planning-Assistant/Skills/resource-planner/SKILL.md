---
name: resource-planner
description: Matches proposed preventive maintenance tasks to specific qualified technicians based on certification/skill match, shift pattern, and real-time free/busy availability, while balancing workload across the technician pool. Use after the Maintenance Scheduler skill has produced a candidate PM task list and a specific, available, certified technician must be assigned to each task before it can be published to a calendar.
---

# Resource Planner

Prevents the common manual-planning failure mode of scheduling a task on a feasible date but with no qualified technician actually available to perform it.

## Instructions

1. **Determine required certification.** Map each PM task's asset class to the certification(s) capable of performing it (e.g., "Rotating Equipment" tasks require `Mechanical` or `Lubrication & Reliability` cert; "Robotics" tasks require `Robotics/PLC` cert). Multi-discipline tasks (e.g., electrical + mechanical) generate a two-technician requirement.
2. **Estimate task duration.** Pull the historical median completion time for that `(task_type, asset_class)` pair from maintenance history; default to the OEM-published standard labor time if no history exists (flag the estimate as "estimate, no history" for transparency).
3. **Filter candidate technicians.** For each task, filter the roster to technicians holding the required certification whose `available_dates` includes the proposed date and whose shift window covers the estimated task duration.
4. **Check calendar free/busy.** Query the Outlook Calendar connector for each candidate technician on the proposed date/time slot; discard any technician with a conflicting event (existing PM assignment, approved leave, training).
5. **Balance workload.** Among remaining candidates, assign using a load-balancing heuristic that minimizes the technician's cumulative scheduled hours for the week relative to their `weekly_hours_capacity`, avoiding the tendency to over-assign the same senior technician while others are under-utilized.
6. **Resolve contention.** If two or more tasks compete for the same technician on the same day and no substitute is available, the task with the higher `priority` (derived from `interval_utilization_at_schedule` and asset `criticality`) retains the slot; re-submit the displaced task to the Maintenance Scheduler skill with a "technician-constrained" flag so it can try an adjacent date.
7. **Emit the assignment.** Return technician-to-task assignments with a resourcing rationale, plus a resource-gap report for tasks that could not be staffed within the horizon (e.g., no certified Instrumentation technician available in the window) for Planner escalation — this typically surfaces the need for cross-training, overtime approval, or contractor sourcing.

## Inputs

| Input | Source | Fields Used |
|---|---|---|
| Proposed PM task list | Maintenance Scheduler skill output | `equipment_id`, `task_type`, `proposed_date`, `priority`, `required_cert` (derived from asset class) |
| Technician roster & availability | SQL Database staging table (synced from Outlook Calendar free/busy + HR system) / Sample Data `technician_availability.csv` | `technician_id`, `name`, `skill_cert`, `shift`, `available_dates`, `weekly_hours_capacity` |
| Calendar free/busy | Outlook Calendar connector | Free/busy per technician per proposed date/time slot |
| Historical task duration | SQL Database (`fact_maintenance_history`) | Actual completion time by task type/asset class, used to estimate hours-required per task |

## Output Format

```json
{
  "plan_id": "PM-20401",
  "equipment_id": "EQ-10088",
  "technician_id": "TECH-1000",
  "technician_name": "Technician A",
  "estimated_hours": 2.5,
  "assignment_rationale": "Technician A holds Mechanical certification, is available 2026-08-19 per calendar free/busy, and is at 62% of weekly capacity (below the 24 scheduled colleagues averaging 78%) — selected to balance workload."
}
```

Also produce:
- Weekly technician utilization report: scheduled hours vs. `weekly_hours_capacity` per technician, flagging both under-70%-utilized and over-100%-utilized weeks.
- Resource-gap report: unstaffed tasks with the specific missing certification/shift combination, to support workforce planning decisions.

## Examples

**Input (excerpt):**
```json
{
  "plan_id": "PM-20401",
  "equipment_id": "EQ-10088",
  "task_type": "Bearing Lubrication & Seal Inspection (2000-hr interval)",
  "proposed_date": "2026-08-19",
  "required_cert": "Rotating Equipment / Lubrication & Reliability"
}
```

**Output:** see the Output Format example above (`TECH-1000`).

## Guardrails

- Never assign a task to a technician who does not hold the required certification, even if they are the only person available — an unstaffed task must be surfaced in the resource-gap report rather than mis-assigned.
- Respect maximum daily/weekly working-hour policy limits; do not recommend assignments that would breach labor/overtime policy without an explicit overtime-approval flag routed to a Planner.
- Do not write directly to a technician's personal Outlook calendar without going through the shared maintenance resource calendar and the technician's delegate-permission grant (per the Outlook Calendar connector's authorization model).
- Surface, rather than silently resolve, any contention where displacing a lower-priority task risks that asset breaching its OEM interval.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
