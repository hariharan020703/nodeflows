---
name: rca-analyzer
description: Performs causal reasoning over a reconstructed equipment-breakdown timeline, grounding SOP/manual excerpts, and matched historical failure cases to produce a ranked, evidence-cited list of probable root causes with confidence levels, plus an optional 5-Why chain. Use when an incident timeline, knowledge-base excerpts, and historical pattern matches are already assembled and a maintenance engineer needs a structured, citation-backed root-cause hypothesis set to review, correct, or approve.
---

# RCA Analyzer

This skill replaces an engineer's unaided "best guess" with a structured, evidence-anchored hypothesis set the engineer can quickly validate, correct, or override.

## Instructions

1. Assemble the full evidence package before reasoning: the reconstructed timeline (with `data_gap` flags and per-entry `source` attribution), SOP/manual/prior-history excerpts from Knowledge Base Search, similar historical cases from Failure Pattern Matcher (including each match's stated root cause and whether its corrective action later proved effective), and the data-completeness flags.
2. Produce 2–5 ranked root-cause hypotheses, each with a `statement`, `confidence` (High/Medium/Low), `rationale`, and a non-empty `evidence_refs` array.
3. Apply a hard confidence cap: if either MES or Historian data was unavailable for the incident window (per completeness flags), no hypothesis may be rated above Medium confidence, regardless of how compelling the SAP PM text alone appears.
4. Validate the output against the Output Format below; reject any hypothesis with an empty `evidence_refs` array.
5. On validation failure, retry once with a stricter instruction reiterating the citation requirement.
6. On repeated failure, or when evidence is genuinely insufficient, return an explicit escalation result (`insufficient_evidence: true` with `missing_evidence_notes`) rather than forcing a low-quality ranked list.
7. If a 5-Why analysis is requested (automatically for Priority 1 breakdowns, or on demand), generate it as a separate step tracing from the observed symptom to the top-ranked root cause, stopping short of 5 steps if evidence runs out rather than fabricating filler reasoning.

## Inputs

| Input | Source | Notes |
|---|---|---|
| Reconstructed timeline | Incident Timeline Builder skill | Includes `data_gap` flags and per-entry `source` attribution |
| SOP/manual/prior-history excerpts | Knowledge Base Search skill | Grounding material |
| Similar historical cases | Failure Pattern Matcher skill | Includes each match's stated root cause and corrective-action effectiveness |
| Data completeness flags | Incident Timeline Builder skill | Drives the confidence cap when MES or Historian data is missing |

## Output Format

```json
{
  "root_causes": [
    {"statement": "...", "confidence": "High|Medium|Low", "rationale": "...", "evidence_refs": ["..."]}
  ],
  "insufficient_evidence": false,
  "missing_evidence_notes": null,
  "five_why_chain": [
    {"why_number": 1, "statement": "...", "evidence_ref": "..."}
  ]
}
```

## Examples

**Input:** Incident `INC-2026-0804-01`, timeline showing vibration rising 2.1→12.4 mm/s and bearing temperature 58.1→95.4°C over 7h10m before trip, flow rate declining from 342 to 248 m3/h; Failure Pattern Matcher returning a 0.91-similarity match (`RCA-2026-0507-EQ10004521`) on the same pump with a stated root cause of "lubrication starvation," corrective action marked ineffective; SOP-PM-0417 excerpt on vibration alarm response; both MES and Historian available (data_completeness = full).

**Output (excerpt):**
```json
{
  "root_causes": [
    {
      "statement": "Bearing lubrication starvation leading to progressive bearing degradation and eventual seizure/high-vibration trip.",
      "confidence": "High",
      "rationale": "Vibration and bearing temperature both rose monotonically over 7h10m with no MES or Historian data gaps, matching the exact signature of a prior confirmed lubrication-starvation failure on this same pump (2026-05-07), where the corrective action (re-grease without replacement) is documented as not having resolved the underlying cause.",
      "evidence_refs": ["historian:VIB-10004521@2026-08-04T01:30Z", "historian:TEMP-10004521@2026-08-04T03:12Z", "mes:evt-88240", "rca:RCA-2026-0507-EQ10004521"]
    },
    {
      "statement": "Impeller wear/cavitation contributing to declining flow rate independent of the bearing condition.",
      "confidence": "Low",
      "rationale": "Flow rate decline from 342 to 248 m3/h over the same window is consistent with impeller-side degradation, but no vibration frequency-spectrum data is available in this Historian extract to distinguish impeller wear from bearing-induced vibration, so this is offered as a secondary contributing hypothesis, not the primary cause.",
      "evidence_refs": ["historian:FLOW-10004521@2026-08-04T02:30Z"]
    }
  ],
  "insufficient_evidence": false
}
```

## Guardrails

- Never emit a root-cause hypothesis without at least one traceable evidence citation; enforce this by validating the output, not merely by prompt instruction.
- Always apply the Medium confidence cap when MES or Historian data was unavailable for the incident window, even if reasoning from SAP PM text alone would otherwise suggest High confidence.
- Never override or discard an engineer's manual correction to the ranking; an engineer's edit always takes precedence over the original ranking in the persisted record.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
