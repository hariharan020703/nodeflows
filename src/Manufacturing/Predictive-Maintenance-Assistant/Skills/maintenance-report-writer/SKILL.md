---
name: maintenance-report-writer
description: Drafts SAP PM maintenance notification text, work order descriptions, and post-completion closing reports on behalf of technicians and engineers, standardizing documentation while keeping every write-back to SAP PM subject to explicit human review and approval before submission. Use after a diagnosis/plan is confirmed and a notification, work order, or closing report needs to be drafted, or when a technician has closed out a job and a closing report needs to be produced.
---

# Maintenance Report Writer

## Instructions

1. **Notification drafting:** Using the confirmed diagnosis, determine `BreakdownIndicator` and `Priority` using the plant's standard mapping rule (criticality class x predicted failure window), applying `NEEDS_HUMAN_INPUT` for any ambiguous case rather than guessing.
2. Draft `ShortText` (concise, field-length-constrained) and `LongText` (full evidence summary) in SAP PM field conventions.
3. Present the draft notification to the Maintenance Engineer for review; do not submit to SAP PM until explicit approval is logged.
4. **Work order text drafting:** Using the approved Maintenance Planner output, draft the work order operation description, referencing the retrieved SOP section where applicable.
5. **Closing report drafting:** At job completion, ingest technician field notes and compare them against the original AI diagnosis; explicitly flag agreement or divergence.
6. Draft the closing report: confirmed root cause, work performed, parts/labor consumed, downtime and estimated cost (using standard plant labor/parts rates), and a `diagnosis_accuracy` field (`confirmed` / `partially_confirmed` / `diverged`) for model feedback logging.
7. Present the closing report to the Technician/Maintenance Engineer for confirmation before it is written back to SAP PM and archived to the SharePoint RCA library.
8. On approval, submit the write-back via the SAP PM connector with an idempotency key; on rejection/edit, incorporate the human's changes and re-present before resubmission.

## Inputs

| Input | Source | Description |
|---|---|---|
| Confirmed diagnosis and root cause | Fault Diagnosis / Root Cause Analysis skill output, confirmed by Maintenance Engineer | Basis for the notification's short/long text and priority. |
| Approved action plan | Maintenance Planner skill output, approved by Planner | Basis for work order scheduling text. |
| Equipment metadata and criticality class | SAP PM via `dim_equipment` | Used for priority determination logic. |
| Technician field notes and completion data | Technician input at job closure | Actual work performed, parts/labor consumed, downtime. |
| Order data | SAP PM (`fact_maintenance_history` / live order record) | Order number, downtime hours, cost for closing report. |

## Output Format

Draft SAP PM notification (matching the payload shape documented in `Connectors/sap-pm/SPEC.md` and the `sap_pm_create_notification` tool in `Connectors/sap-pm/tools.json`), held for human approval:

```json
{
  "notification_draft": { "NotificationType": "<M1|M2|M3>", "Equipment": "<string>", "BreakdownIndicator": true, "Priority": "<1-4>", "ShortText": "<string>", "LongText": "<string>" },
  "work_order_text_draft": "<string>",
  "closing_report_draft": {
    "confirmed_root_cause": "<string>",
    "work_performed": "<string>",
    "parts_labor_cost_estimate": 0.0,
    "downtime_hours": 0.0,
    "diagnosis_accuracy": "confirmed|partially_confirmed|diverged"
  },
  "pending_human_approval": true
}
```

## Examples

**Input (abridged, closing report):**
```json
{
  "order_no": "3000100",
  "equipment_id": "10004521",
  "original_diagnosis": "Bearing wear - outer race defect",
  "technician_notes": "Confirmed outer race spalling on removal, consistent with prediction. Replaced bearing kit FT-BRG-500K. Lubrication grease was visibly degraded/contaminated.",
  "downtime_hours": 6.2,
  "parts_consumed": [{"part": "FT-BRG-500K", "qty": 1, "unit_cost": 640}],
  "labor_hours": 5.0
}
```

**Output:**
```json
{
  "closing_report_draft": {
    "confirmed_root_cause": "Outer race spalling due to degraded/contaminated lubrication, consistent with original AI diagnosis",
    "work_performed": "Isolated pump per LOTO-STD-002, removed bearing housing, replaced bearing kit FT-BRG-500K, replenished lubrication per SOP-PUMP-014 Section 4.3",
    "parts_labor_cost_estimate": 1740.00,
    "downtime_hours": 6.2,
    "diagnosis_accuracy": "confirmed"
  },
  "pending_human_approval": true
}
```

## Guardrails

- No SAP PM write-back (notification creation, work order text, or closure) occurs without a logged explicit human approval action.
- `BreakdownIndicator` and `Priority` fields must never be set by model discretion beyond the stated mapping rule; ambiguous cases are flagged `NEEDS_HUMAN_INPUT`.
- The `diagnosis_accuracy` field must always be populated at closure — it is the primary signal for model recalibration and cannot be silently omitted.
- Drafts must clearly distinguish AI-generated text from technician-provided text so reviewers know what they are verifying versus what is a direct quote.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
