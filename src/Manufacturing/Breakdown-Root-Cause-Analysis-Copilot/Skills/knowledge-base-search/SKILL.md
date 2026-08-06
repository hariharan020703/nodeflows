---
name: knowledge-base-search
description: Retrieves grounding reference material — SOPs, OEM equipment manuals, and prior notification/work order history for a specific asset — so root-cause reasoning is anchored in documented procedure and precedent rather than generic mechanical knowledge. Use when an equipment ID and symptom description are available and approved SOP/manual excerpts or prior maintenance history for that exact asset are needed before or during root-cause analysis.
---

# Knowledge Base Search

This skill answers "what does the manual/SOP say about this equipment and this symptom," distinct from Failure Pattern Matcher, which answers "has this exact failure signature happened before."

## Instructions

1. Resolve the equipment's type, manufacturer, and model from the SAP PM Equipment Master.
2. Query SharePoint via the Microsoft Graph Search API and the RAG vector index for SOP library and OEM manual content tagged to this equipment type/model, scoped to the sites the service account is authorized against.
3. Query SAP PM for prior notifications and work orders on the same Functional Location (independent of the current incident) to surface repair/maintenance history the engineer may not immediately recall.
4. Rank retrieved documents/records by relevance to the current symptom description (keyword + embedding similarity).
5. For any retrieved SOP or manual section describing a safety-critical procedure (lockout/tagout, pressure release, electrical isolation), extract and return the text verbatim — never paraphrased.
6. Return a ranked result set with source document metadata (title, version/effective date, section reference) so every citation is traceable.

## Inputs

| Input | Source | Notes |
|---|---|---|
| Equipment ID, type, manufacturer, model | SAP PM Equipment Master | e.g., `10004521`, Centrifugal Pump, Grundfos NB 150-315 |
| Functional Location | SAP PM | Used to scope SharePoint document retrieval and prior notification lookup |
| Symptom/failure description | Breakdown notification short text, or user query | Search query seed |

## Output Format

```json
{
  "documents": [
    {"document_title": "...", "version": "...", "section_reference": "...", "excerpt_text": "...", "source_type": "SOP|OEM_MANUAL|SAP_PM_HISTORY", "source_url": "..."}
  ]
}
```

## Examples

**Input:** Equipment `10004521` (Centrifugal Pump, Grundfos NB 150-315), symptom "abnormal vibration and bearing overheating."

**Output (excerpt):**
```json
[
  {
    "document_title": "SOP-PM-0417: Centrifugal Pump Bearing Inspection & Lubrication",
    "version": "v3.2",
    "section_reference": "Section 4.2 - Vibration Alarm Response",
    "excerpt_text": "If vibration velocity exceeds 7.1 mm/s RMS, initiate bearing housing thermal check within 30 minutes and verify lubrication schedule compliance for the prior 30 days before returning the pump to service.",
    "source_type": "SOP",
    "source_url": "sharepoint://PlantA-Maintenance/SOPs/Pumps/SOP-PM-0417.pdf"
  },
  {
    "document_title": "Prior Notification History — Functional Location PLANT-A-LINE3-PUMP01",
    "version": "n/a",
    "section_reference": "NOTIF-1000541220 (2026-05-07)",
    "excerpt_text": "High vibration trip; bearing inspected and re-greased; no replacement performed.",
    "source_type": "SAP_PM_HISTORY",
    "source_url": "sap-pm://NOTIF-1000541220"
  }
]
```

## Guardrails

- Return safety-critical procedure text (lockout/tagout, pressure/electrical isolation) verbatim, never paraphrased or summarized, to avoid introducing errors into safety instructions.
- Only return documents the requesting service account/user has effective permission to access under existing SharePoint sensitivity labels and data-loss-prevention policies — never bypass or elevate access.
- Discard any excerpt that lacks a traceable source reference rather than presenting it as ungrounded text.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
