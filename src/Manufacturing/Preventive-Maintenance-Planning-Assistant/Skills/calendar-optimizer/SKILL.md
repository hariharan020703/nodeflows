---
name: calendar-optimizer
description: Converts a scheduler-produced, resource-assigned preventive maintenance task set into a published, conflict-free calendar, and re-optimizes it when real-world disruptions occur (a production freeze extends, a technician calls in sick, an asset trips into breakdown). Use when a resourced PM schedule is ready to publish to Outlook Calendar and Teams, when a disruption event affects an already-published schedule, or when a planner submits a natural-language re-planning request.
---

# Calendar Optimizer

Creates and maintains the actual Outlook Calendar events and Teams notifications, and keeps the published calendar synchronized with the underlying constraint model so the calendar is always the accurate, current source of "what happens when."

## Instructions

1. **Publish the initial calendar.** For each resourced task, create an Outlook Calendar event on the shared "Plant Maintenance Schedule" resource calendar with the asset as location, the assigned technician(s) as required attendees, subject formatted as `PM-{plan_id}: {task_type} — {equipment description}`, and duration set from `estimated_hours`.
2. **Run a pre-publish conflict check.** Before writing, query free/busy for every attendee at the proposed time; on conflict, do not double-book — request up to 3 alternative slots from the underlying constraint model (re-invoking the Maintenance Scheduler skill with the conflicting slot excluded) before escalating to a human planner.
3. **Monitor for disruption events.** Watch for ERP production-plan change events and SAP PM breakdown-notification events. On a disruption (e.g., a production freeze is extended, or a breakdown consumes the technician who was assigned to a PM task), identify every published calendar event impacted.
4. **Re-optimize incrementally.** Rather than re-solving the entire horizon from scratch, re-invoke the Maintenance Scheduler/Resource Planner skills scoped to only the impacted tasks and the remaining open horizon, holding all unaffected, already-confirmed tasks fixed (a "warm restart" to minimize unnecessary churn to technicians' calendars).
5. **Parse natural-language re-planning requests.** For chat-driven requests, extract structured intent (scope: which line/asset/date range; action: shift/cancel/prioritize) and translate it into a set of constraint-model modifications (e.g., "temporarily exclude Line 3 dates Aug 18–22 from the feasible-date domain"), then re-run step 4 and present the diff (what moved, why, and any new resource gaps) for planner confirmation before writing back to calendars.
6. **Write back and notify.** On confirmation, update/cancel the affected Outlook events and post a Teams adaptive card summarizing the change to the affected technicians and the Planner, with an "Approve"/"Request Change" action per the Microsoft Teams connector's interactive card pattern.
7. **Log every change** (original slot, new slot, trigger reason, approver) to the audit table for schedule-compliance reporting.

## Inputs

| Input | Source | Fields Used |
|---|---|---|
| Resourced PM task list | Resource Planner skill output | `plan_id`, `equipment_id`, `technician_id`, `proposed_date`, `estimated_hours` |
| Existing calendar state | Outlook Calendar connector | Existing events on the shared maintenance resource calendar and technician calendars, for conflict/double-booking detection |
| Disruption events | Event trigger (production-freeze change in ERP, technician leave request, breakdown notification from SAP PM) | Type of disruption, affected date range/technician/asset |
| Natural-language re-planning requests | Teams/chat interface | Free-text planner requests (e.g., "push everything on Line 3 next week to the week after") |

## Output Format

```json
{
  "reoptimization_summary": [
    {"plan_id": "PM-20430", "equipment_id": "EQ-40010", "old_date": "2026-08-15", "new_date": "2026-08-26", "reason": "Line 3 production freeze extended to Aug 24; next feasible slot with certified Molding technician (Technician K) is Aug 26.", "interval_risk": "None — utilization at new date projected at 91%, within threshold."},
    {"plan_id": "PM-20431", "equipment_id": "EQ-40012", "old_date": "2026-08-16", "new_date": "2026-08-25", "reason": "Same freeze extension.", "interval_risk": "Elevated — utilization at new date projected at 103%; flagged for Planner review."}
  ],
  "notification": "Teams adaptive card posted to Maintenance Planner and Technician K summarizing 2 rescheduled tasks, 1 flagged interval risk."
}
```

Also produce:
- Published/updated Outlook Calendar events for each PM task.
- Teams adaptive card change notifications with approve/request-change actions.
- Audit log entries for every calendar write-back.

## Examples

**Input (excerpt — disruption event):**
```json
{
  "event": "production_plan_change",
  "line": "LINE3",
  "change": "planned_end extended from 2026-08-17 to 2026-08-24",
  "affected_plan_ids": ["PM-20430", "PM-20431"]
}
```

**Output:** see the Output Format example above (`reoptimization_summary`).

## Guardrails

- Never write a calendar change without first running the free/busy conflict check; never silently overwrite an existing, unrelated calendar event.
- Any re-optimization that pushes a Critical-criticality asset's task past its OEM interval must be surfaced as a flagged risk requiring explicit Planner sign-off before write-back — it must never be auto-approved even under a "warm restart."
- Natural-language re-planning requests must always be confirmed via a shown diff before any write-back occurs; the extracted intent is never executed directly against production calendars without a human-readable preview step.
- All disruption-triggered re-optimizations and their approvals are logged with the triggering event ID for full audit traceability.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
