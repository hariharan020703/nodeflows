---
name: root-cause-analysis
description: Builds an evidence-grounded root-cause hypothesis for a diagnosed equipment failure mode by retrieving and reasoning over comparable historical RCA reports and OEM guidance using retrieval-augmented generation, so conclusions are traceable to specific prior incidents or manufacturer documentation. Use after a failure mode has been diagnosed and a technician or engineer needs a structured, cited causal explanation before planning repair work.
---

# Root Cause Analysis

## Instructions

1. Formulate a retrieval query from the diagnosed failure mode, equipment type, and manufacturer/model, and run it against the SharePoint-backed vector index for both the RCA archive and OEM manuals.
2. Score retrieved documents for relevance using both semantic similarity and metadata match (EquipmentType/Model), discarding results below the minimum relevance threshold (default 0.60, configurable).
3. Cross-reference the equipment's own maintenance history for recent related interventions (e.g., "was this bearing replaced in the last 6 months, which would make wear-out less likely and installation defect more likely").
4. Construct a structured 5-Why causal chain, requiring each step to be supported by either a retrieved document citation or a specific maintenance/sensor record.
5. Stop the causal chain at the last step supportable by evidence; do not extend the chain speculatively.
6. If no retrieved document or record meets the relevance threshold, output "insufficient precedent to determine root cause" rather than inventing a plausible-sounding cause.
7. Attach an overall confidence label (High/Medium/Low/Insufficient Evidence) based on the number and quality of supporting citations.
8. Pass the root-cause hypothesis and citations forward to the Maintenance Planner and Maintenance Report Writer skills.

## Inputs

| Input | Source | Description |
|---|---|---|
| Diagnosed failure mode(s) and confidence | Fault Diagnosis skill output | The candidate failure mode(s) to investigate. |
| Equipment metadata | SAP PM via `dim_equipment` | Equipment type, manufacturer, model — used to scope retrieval. |
| Retrieved historical RCA reports | SharePoint RCA archive (vector index) | Prior incidents with matching equipment type and symptom pattern. |
| Retrieved OEM guidance | SharePoint OEM manuals library (vector index) | Manufacturer failure-mode and troubleshooting documentation. |
| Recent maintenance history | SQL Database `fact_maintenance_history` | Prior repairs/interventions on this specific asset that may be relevant context. |

## Output Format

```json
{
  "root_cause_chain": [
    {"why": "<string>", "answer": "<string>", "citation": {"source_type": "<string>", "source_id": "<string>", "excerpt": "<string>"}}
  ],
  "root_cause_hypothesis": "<string>",
  "confidence": "High|Medium|Low|Insufficient Evidence"
}
```

- Every entry in `root_cause_chain` except a terminal "insufficient precedent" step must carry a `citation`.
- `root_cause_hypothesis` is a one-line summary of the causal chain's conclusion.

## Examples

**Input (abridged):**
```json
{
  "failure_mode": "Bearing wear - outer race defect",
  "equipment_id": "10004521",
  "equipment_type": "Centrifugal Pump",
  "manufacturer": "Flowtech",
  "model": "FT-CP-500"
}
```

**Output:**
```json
{
  "root_cause_chain": [
    {"why": "Why did the outer race show wear signature?", "answer": "Sustained radial vibration above 3.5 mm/s over 6+ weeks consistent with bearing race spalling", "citation": {"source_type": "sensor_data", "source_id": "fact_sensor_readings", "excerpt": "Vibration RMS trend 1.05 -> 4.22 mm/s over 60 days"}},
    {"why": "Why would spalling develop over this timeframe?", "answer": "Comparable RCA report on same pump model found inadequate lubrication interval as the driver", "citation": {"source_type": "sharepoint_rca", "source_id": "RCA-2024-0117 Flowtech FT-CP-500 Bearing Failure, Section 3", "excerpt": "Root cause: lubrication interval exceeded OEM spec by 40%"}},
    {"why": "Why was the lubrication interval exceeded?", "answer": "Insufficient precedent to determine further root cause from available records"}
  ],
  "root_cause_hypothesis": "Likely bearing spalling driven by extended lubrication interval, consistent with a prior documented incident on the same pump model",
  "confidence": "Medium"
}
```

## Guardrails

- Every causal chain step must carry a citation; steps without a supporting citation must not be included.
- Must not extend a causal chain further than the retrieved evidence supports — "insufficient precedent" is a required, valid, and expected output, particularly for novel failure modes.
- Must weight metadata match (equipment type/model) alongside semantic similarity to avoid retrieving superficially similar but causally unrelated incidents.
- Confidence labels must reflect actual citation count/quality, not self-assessment alone.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
