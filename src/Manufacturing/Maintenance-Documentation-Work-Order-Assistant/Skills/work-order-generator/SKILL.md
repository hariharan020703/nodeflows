---
name: work-order-generator
description: Drafts a structured SAP PM maintenance notification and/or work order from fused technician evidence (note text, voice transcript, photo assessment), pre-populated with equipment and functional-location data retrieved from SAP PM, ready for a technician or maintenance engineer to review, edit, and approve before write-back. Use when new or updated technician evidence exists for an equipment issue and it needs to become a SAP PM notification/work order draft instead of being manually re-typed.
---

# Work Order Generator

## Instructions

1. Query SAP PM (via the SAP PM connector) to resolve the evidence record's equipment reference to a canonical Equipment ID and Functional Location; if unresolved, prepare a reviewer-facing candidate list rather than guessing.
2. Query SAP PM for open/recent notifications and work orders against the same equipment within a configurable lookback window (default 24 hours) to check for a likely duplicate submission.
3. Determine the most probable SAP PM Notification Type (M1 general / M2 malfunction / M3 maintenance request) from the note_text/transcript content.
4. Draft `ShortText` (concise, SAP field-length constrained) and `LongText` (fuller description) using only information present in the source evidence, citing the specific phrase(s) used for each.
5. Set the `BreakdownIndicator` flag only where the evidence clearly describes a stoppage or safety-relevant failure; otherwise leave `false`.
6. Recommend a Priority level with a one-sentence justification tied to the described impact.
7. If a `photo_assessment` is present and flags a discrepancy, surface that flag prominently in the draft rather than proceeding as if the evidence were clean.
8. Package the draft as a Teams adaptive card for the designated reviewer (the submitting technician for straightforward cases, or a maintenance engineer for ambiguous/duplicate/discrepancy-flagged cases).
9. On reviewer approval, execute the SAP PM OData write-back (notification and/or work order creation) with an idempotency key, and log the write with the approver's identity and a payload hash. This write-back must never occur without that logged, explicit human approval — see Guardrails.
10. On reviewer edit request, return the edited fields and any reviewer comment to the drafting prompt for regeneration rather than a blind resubmission.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.

## Inputs

- Structured repair evidence record (fused note_text / transcript / photo_assessment) from the Fusion Layer.
- `equipment_id` (resolved or candidate) and, where resolved, the SAP PM Equipment Master / Functional Location lookup result.
- Recent related orders/notifications for the same equipment (for duplicate-detection context).
- Applicable SharePoint SOP/OEM excerpts (retrieved via RAG) to ground failure-mode terminology.

## Output Format

Produce a draft SAP PM notification/work order payload with source citations and duplicate/discrepancy flags:
```json
{
  "NotificationType": "M2",
  "Equipment": "10004541",
  "FunctionalLocation": "PLANT-A-LINE2-GEARBOX03",
  "ShortText": "Output shaft seal leak - Gearbox03",
  "LongText": "Gearbox03 on line2 leaking oil from the output shaft area, oil level low on dipstick check. Shaft seal suspected failed. Temporary oil top-off performed pending seal part (GB-3311-SEAL).",
  "BreakdownIndicator": false,
  "Priority": "2",
  "priority_reasoning": "Active leak with degraded lubrication risk but equipment still operating; not a full stoppage.",
  "possible_duplicate_of": null,
  "source_citations": ["\"leaking oil from the output shaft area\"", "\"oil level was low when I checked with dipstick\""]
}
```

## Examples

**Input:** Technician note (from `Sample Data/technician_notes.csv`, WO-2026-100203): "Gearbox03 line2 leaking oil from the output shaft area, dripping onto the floor under the machine, put absorbent pad down. Looks like the shaft seal has failed, oil level was low when I checked with dipstick. Ordered the GB-3311-SEAL part... Topped off gear oil temporarily to keep it running until seal comes in."

**Output:** The JSON draft shown above, presented to TECH-1001 for review; on approval, a Maintenance Notification is created in SAP PM sandbox/production with the fields shown, and the corresponding audit log entry records TECH-1001 as approver.

## Guardrails

- Never write to SAP PM without an explicit, logged human approval tied to a specific reviewer identity (non-negotiable per FR-8/FR-9).
- Never invent an Equipment or FunctionalLocation value; an unresolved reference must be presented to the reviewer as a selection task, not silently defaulted.
- A detected possible duplicate must always be surfaced for reviewer confirmation before a new notification is created — never auto-merged and never silently ignored.
- Priority and BreakdownIndicator are recommendations; the reviewer's override always takes precedence and is what gets logged as the final approved value.
