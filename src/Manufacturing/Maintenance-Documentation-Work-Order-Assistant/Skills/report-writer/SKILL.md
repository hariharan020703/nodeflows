---
name: report-writer
description: Drafts structured maintenance completion reports and repair completion certificates from fused technician evidence (notes, voice transcripts, and photo assessments) once a work order reaches completed status. Use when a work order's status becomes Completed or Completed - Follow-up Required and a narrative completion document is needed for engineer review before SharePoint archival and Outlook distribution.
---

# Report Writer

## Instructions

1. Assemble the full chronological set of note/transcript entries for the work order (a work order may have multiple entries, e.g., an initial diagnosis note and a later completion note).
2. Draft a Root Cause Narrative using only what is explicitly stated or visually evident in the source evidence. If no clear root cause is stated, output "Root cause not conclusively documented by technician" rather than inferring one.
3. Draft a Repair Action Summary referencing the specific `parts_used` and `labor_hours`, tied to the completion-stage note/transcript entry.
4. If `status` is "Completed - Follow-up Required," extract and include the specific follow-up condition described by the technician.
5. If any associated `photo_assessment` carries a `discrepancy_flag`, include a Photo Evidence Note section surfacing the discrepancy explicitly rather than omitting it.
6. Cite the specific note/transcript text supporting the Root Cause Narrative and Repair Action Summary.
7. Package the draft as a reviewable document (a Teams adaptive card summary plus a full document view) and route it to the assigned maintenance engineer for review.
8. On approval, archive the final document and its source evidence to SharePoint (tagged `AI-Generated`, pending-review flag cleared) and distribute via Outlook to the configured recipient list (engineering, plant management, warranty/compliance as applicable).

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.

## Inputs

- Structured repair evidence record for the full lifecycle of a work order (all chronological `note_text`/transcript entries associated with that `work_order_ref`).
- `photo_assessment` result(s), including any `discrepancy_flag`.
- `labor_hours` and `parts_used` (from technician input or the `work_order_completion` data source).
- `status` (e.g., Completed, Completed - Follow-up Required).
- Relevant SharePoint SOP/OEM/RCA content retrieved via RAG for terminology grounding.

## Output Format

Produce a structured completion document:
```
Header: Order WO-2026-100205 | Equipment 10004555 (Motor07, Line 5) | Completed 2026-07-29 | Technician TECH-1004
Root Cause Narrative: Drive-end and non-drive-end motor bearings had degraded, producing a grinding noise and elevated drive-end vibration and bearing-end temperature (78C). A cracked terminal box gasket allowed moisture ingress, which the technician noted likely contributed to bearing wear.
Repair Action Summary: Replaced both bearings with a 6309-2RS kit and replaced the terminal box gasket. Post-repair insulation resistance tested at 42 Mohm. Ran 30 minutes no-load and 20 minutes under load with noise eliminated and vibration returned to baseline.
Parts & Labor: Motor bearing set 6309-2RS; terminal box gasket. Labor: 5.0 hours.
Follow-Up Required: Status marked "Completed - Follow-up Required" - flagged by technician for continued monitoring of vibration/noise over the following week given the moisture-ingress root cause.
Source Citations: "grinding noise on startup, got worse over the shift"; "terminal box gasket, old one was cracked and letting moisture in"; "Meggered the windings after reassembly, insulation resistance reads good at 42 Mohm."
```

## Examples

**Input:** The two chronological notes for WO-2026-100205 in `Sample Data/technician_notes.csv` (initial diagnosis at 05:15 and completion at 13:40), plus the corresponding row in `work_order_completion.csv` (status: Completed - Follow-up Required, labor_hours: 5.0, parts_used: "Motor bearing set 6309-2RS; terminal box gasket").

**Output:** The structured document shown above, routed to the assigned maintenance engineer for review before SharePoint archival and Outlook distribution.

## Guardrails

- Never state a root cause not explicitly supported by the source evidence; use the "not conclusively documented" fallback rather than inferring.
- Always surface a photo-evidence `discrepancy_flag` in the output rather than omitting it because it complicates an otherwise clean-looking completion.
- Never distribute or archive a completion document without maintenance-engineer approval (FR-8/FR-9); a rejected draft returns to regeneration with reviewer comments, not a forced resubmission of the same content.
- Completion certificates (a compliance/warranty-weight variant of this skill's output, see Prompt Library.md Prompt 6) require an explicit, unfilled signature block - never simulate a signature or an approval statement on the engineer's behalf.
