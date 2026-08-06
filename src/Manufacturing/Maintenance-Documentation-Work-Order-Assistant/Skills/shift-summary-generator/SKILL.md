---
name: shift-summary-generator
description: Compiles a structured, consistent shift handover summary at shift end from the shift's actual SAP PM work order status and generated reports/notes. Use on a shift-end trigger (scheduled per plant/shift) to replace a free-text, memory-dependent handover email or Teams message with a summary whose completeness does not depend on which individual wrote it.
---

# Shift Summary Generator

## Instructions

1. On the shift-end trigger (scheduled per plant/shift), query SAP PM for the current status of all work orders touched during the shift window for that plant.
2. Cross-reference the SAP PM query result against the drafted list of completed and pending orders to catch any status drift (see Prompt Library.md Prompt 9 — pre-distribution consistency check) before drafting.
3. Group completed orders by equipment/line and summarize each in one sentence, confirming closure.
4. List pending/open orders with current status (e.g., Pending Parts, In Progress) and any specific note the incoming shift needs (e.g., a part on backorder, a workaround in place).
5. Extract notable events from the shift's completion reports and technician notes — prioritizing anything describing a safety-relevant condition, a temporary workaround, or an escalation — and place these at the top of the summary rather than embedded in the general list.
6. Carry forward any unresolved watch item from the prior shift's handover that has not since been closed in SAP PM.
7. Assemble the four-section handover document (Summary, Completed This Shift, Open/Pending Items, Watch Items) and route it to the shift supervisor for review and approval.
8. On approval, post the summary to the incoming shift's Microsoft Teams channel and distribute via Outlook to the configured planner/plant-management recipient list.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.

## Inputs

- SAP PM order/notification status query for the plant and shift window (completed and pending/open orders).
- The shift's generated completion reports and technician notes (notable events, escalations, follow-up flags).
- `shift_log` context fields: `shift_id`, `plant`, `shift_date`, `shift_type`, `orders_completed`, `orders_pending`, `notable_events`.
- Prior shift's handover summary (for continuity — carrying forward unresolved watch items).

## Output Format

Produce a structured shift handover summary:
```
Plant B - Monterrey | 2026-08-02 | Day Shift
Summary: 2 orders completed, 1 order remains open (parts backorder). No safety-relevant open items.
Completed This Shift:
 - Chiller02: Refrigerant leak brazed at liquid line, pressure tested, recharged with 4.5kg R-134a (WO-2026-100218). Closed.
 - HVAC01: Belt set and sheave alignment corrected, squeal eliminated (WO-2026-100220). Closed.
Open/Pending Items:
 - Conv05 (line2): Gearmotor seized, replacement (PN CV5-GM-750) on backorder from regional warehouse (WO-2026-100219). Line running on backup short-route conveyor at reduced throughput.
Watch Items:
 - Monitor Conv05 backup-route throughput impact; expedite gearmotor shipping if backorder extends beyond planner's committed ETA.
```

## Examples

**Input:** The `SFT-B-0802-D` row from `Sample Data/shift_log.csv` (Plant B - Monterrey, 2026-08-02, Day, orders_completed=2, orders_pending=1) plus the corresponding completed/pending work order detail from `work_order_completion.csv` (WO-2026-100218, WO-2026-100220 completed; WO-2026-100219 pending parts).

**Output:** The structured handover shown above, presented to the Plant B day-shift supervisor for approval before posting to the Plant B night-shift Teams channel and distribution via Outlook.

## Guardrails

- Never omit a pending/open item present in the live SAP PM query, even if it seems minor — the consistency check in step 2 exists specifically to prevent a stale or incomplete handover.
- Safety-relevant or workaround-dependent items must always appear in the Watch Items / top-of-summary position, never buried below routine completed-order detail.
- Never distribute the handover summary without shift-supervisor approval (FR-11); a flagged discrepancy from the pre-distribution consistency check must be resolved by the reviewer, not silently auto-corrected by the model.
- A carried-forward watch item must be re-verified against current SAP PM status before being repeated in a new handover — never repeat a stale watch item that has since been resolved.
