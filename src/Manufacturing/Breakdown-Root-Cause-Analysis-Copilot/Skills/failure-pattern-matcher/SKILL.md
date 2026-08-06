---
name: failure-pattern-matcher
description: Runs embedding-based similarity search over a vector index of historical root-cause-analysis reports to determine whether a current equipment breakdown's failure signature matches a previously investigated breakdown, returning ranked matches with their stated root cause and corrective-action effectiveness. Use when investigating a new breakdown and prior similar failures on the same or similar equipment need to be surfaced before or alongside root-cause reasoning.
---

# Failure Pattern Matcher

This skill turns "does anyone remember a failure like this" from a matter of individual tenure and memory into a systematic, always-available lookup — directly addressing the pain point that a large share of repeat breakdowns stem from a root cause that was never correctly identified the first time.

## Instructions

1. Construct a structured failure-signature string for the current incident: equipment type + reason code + key sensor deltas (e.g., "vibration rose from 2.1 to 12.4 mm/s over 7h10m; bearing temp rose from 58C to 95.4C; trip on high vibration interlock") + free-text failure description.
2. Generate an embedding vector for the failure signature using the enterprise embedding model.
3. Query the vector index of historical RCA report embeddings for the top-N (default 5) nearest neighbors by cosine similarity.
4. Filter results to only those meeting or exceeding the governed similarity threshold (default 0.70); never lower the threshold to force a result.
5. For each retained match, retrieve the report ID, equipment, date, stated root cause, and corrective action taken/effectiveness (whether a follow-up notification indicates recurrence).
6. Return the ranked match list, or an explicit empty result if nothing clears the threshold — absence of precedent is itself meaningful information for the RCA Analyzer.

## Inputs

| Input | Source | Notes |
|---|---|---|
| Equipment type/model | SAP PM Equipment Master | e.g., Centrifugal Pump, Grundfos NB 150-315 |
| MES reason code | MES downtime event | e.g., `BEARING_FAILURE` |
| Key sensor trend deltas | Incident Timeline Builder output | e.g., vibration rise rate, peak temperature, time-to-trip from alarm threshold crossing |
| Free-text failure description | SAP PM notification short text | Used as an additional embedding input |
| Historical RCA report vector index | SharePoint (embedded on publish/change) | Populated on RCA report publish |

## Output Format

```json
{
  "matches": [
    {"report_id": "...", "equipment": "...", "date": "YYYY-MM-DD", "root_cause": "...", "corrective_action": "...", "corrective_action_effective": true, "similarity_score": 0.0}
  ],
  "no_precedent_found": false
}
```

## Examples

**Input:** Failure signature for incident `INC-2026-0804-01` (Equipment `10004521`, bearing failure, vibration 2.1→12.4 mm/s over 7h, bearing temp peak 95.4C).

**Output:**
```json
{
  "matches": [
    {
      "report_id": "RCA-2026-0507-EQ10004521",
      "equipment": "10004521",
      "date": "2026-05-07",
      "root_cause": "Bearing lubrication starvation due to missed lubrication cycle; bearing re-greased, not replaced.",
      "corrective_action": "Manual re-lubrication; PM interval not adjusted.",
      "corrective_action_effective": false,
      "similarity_score": 0.91
    },
    {
      "report_id": "RCA-2026-0329-EQ10004522",
      "equipment": "10004522",
      "date": "2026-03-29",
      "root_cause": "Lubrication schedule gap causing bearing overheating and failure.",
      "corrective_action": "Bearing replaced; lubrication schedule not revised at that time.",
      "corrective_action_effective": false,
      "similarity_score": 0.84
    }
  ],
  "no_precedent_found": false
}
```
This match is the clearest evidence in the sample dataset that the May 7 corrective action — re-greasing without replacement or PM interval change — did not address the underlying root cause, and the same failure recurred on the same pump three months later.

## Guardrails

- Treat the similarity threshold as a governed configuration value; never silently lower it to avoid returning an empty result — an empty result is a valid and honest output.
- Always include the historical report's actual outcome (including whether the corrective action was later found ineffective, i.e., the failure recurred) so downstream skills and the engineer are not shown a false sense of "this was already solved."
- Never merge or average multiple historical matches into a single synthesized root cause; present each match distinctly so provenance stays traceable.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
