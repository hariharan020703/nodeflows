---
name: sop-retrieval
description: Retrieves the precise standard operating procedure (SOP) or checklist section relevant to a diagnosed fault or a planned maintenance task, restricted to the current approved document version, instead of a whole-document link. Use when a technician needs the exact, current procedure for a diagnosed failure mode or planned maintenance task surfaced before or during a job.
---

# SOP Retrieval

## Instructions

1. Formulate a retrieval query combining the failure mode or task description with the equipment type/model.
2. Run vector similarity search against the SharePoint SOP Library index, restricted by metadata filter to matching `EquipmentType` (and `EquipmentModel` where available).
3. Exclude any SOP version that is not the current approved version (filter on `EffectiveDate` and supersession status) — never surface a superseded procedure.
4. From the top-matching document, identify and extract the specific section (not the whole document) most relevant to the diagnosed fault/task, using section headers and semantic sub-chunk similarity.
5. Attach document metadata (title, version, ApprovedBy, EffectiveDate) to the retrieved section for the technician's assurance that it is current and approved.
6. If no SOP matches above the minimum relevance threshold (default 0.65, configurable) for the given equipment type/model, explicitly state that no matching SOP was found rather than surfacing a loosely related document as if it were authoritative.
7. Pass the retrieved section into the risk briefing (for pre-failure prompts) or directly to the technician's work order view (for execution-time prompts).

## Inputs

| Input | Source | Description |
|---|---|---|
| Diagnosed failure mode or planned maintenance task | Fault Diagnosis / Maintenance Planner skill output | What procedure is needed. |
| Equipment type/model | SAP PM via `dim_equipment` | Used to filter SOPs to the correct equipment variant. |
| SOP library (embeddings) | SharePoint SOP Library (vector index, re-indexed on document-change webhook) | Source documents: title, EquipmentType, Version, ApprovedBy, EffectiveDate, full text. |

## Output Format

```json
{
  "sop_title": "<string>",
  "sop_version": "<string>",
  "approved_by": "<string>",
  "effective_date": "<ISO-8601 date>",
  "retrieved_section": "<string>",
  "not_found": false
}
```

When no match clears the relevance threshold, return `"not_found": true` with `sop_title`/`retrieved_section` omitted or null, plus a suggestion to escalate to the Maintenance Engineer for a manual procedure decision.

## Examples

**Input (abridged):**
```json
{
  "failure_mode": "Bearing wear - outer race defect",
  "equipment_type": "Centrifugal Pump",
  "equipment_model": "FT-CP-500"
}
```

**Output:**
```json
{
  "sop_title": "SOP-PUMP-014: Centrifugal Pump Bearing Inspection and Replacement",
  "sop_version": "3.2",
  "approved_by": "Reliability Engineering",
  "effective_date": "2025-11-01",
  "retrieved_section": "Section 4.3 - Outer Race Wear Inspection: With pump isolated and locked out per LOTO-STD-002, remove bearing housing cover... measure radial clearance... replace bearing kit P/N FT-BRG-500K if clearance exceeds 0.08mm...",
  "not_found": false
}
```

## Guardrails

- Must never return a superseded SOP version; version/effective-date filtering is mandatory, not optional.
- Must return the specific relevant section, not the full document, to reduce time-to-information at the point of work.
- Must explicitly state "no matching SOP found" rather than returning a low-relevance document as if authoritative.
- Must preserve and display SOP approval metadata so the technician can independently verify currency in the field.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
