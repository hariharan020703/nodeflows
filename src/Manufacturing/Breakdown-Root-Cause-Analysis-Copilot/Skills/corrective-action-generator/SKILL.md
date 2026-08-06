---
name: corrective-action-generator
description: Converts a ranked root cause into a concrete, equipment-specific corrective action plan (immediate containment plus longer-term preventive fix) and assembles a management-ready RCA report draft. Use after root causes have been ranked and evidence-cited, when a maintenance engineer needs a draft corrective action plan and full RCA report ready for review before anything is written back to source systems.
---

# Corrective Action Generator

This skill turns "we know why it broke" into "here is what we are going to do about it," which is where most manual RCA efforts run out of time and stop short.

## Instructions

1. Take the top-ranked (or, post-engineer-review, the confirmed) root cause and its supporting SOP excerpt.
2. Draft an immediate containment action: what should be verified/adjusted before the equipment is trusted back in full production (e.g., inspection, parameter reset, temporary monitoring).
3. Draft a preventive corrective action addressing the root cause itself, not the symptom — explicitly check whether a similar past corrective action (from Failure Pattern Matcher) was later found ineffective, and if so, propose a materially different action this time (e.g., moving from "re-grease" to "replace bearing and revise PM lubrication interval").
4. Assign a suggested owner role (Maintenance Engineer, Reliability Engineer, Planner) and target timeframe to each action.
5. Assemble the full RCA report using the standard template: Executive Summary, Incident Timeline (condensed), Root Cause Analysis, Corrective Actions, Historical Context, Evidence Appendix — header marked "AI-Generated Draft — Pending Maintenance Engineer Review."
6. Pass the assembled draft to the orchestrating workflow for delivery (e.g., to Microsoft Teams); do not publish to SharePoint or write back to SAP PM directly — that occurs only after engineer approval, handled by the orchestrating workflow.

## Inputs

| Input | Source | Notes |
|---|---|---|
| Ranked root cause(s) | RCA Analyzer skill | Typically the top-ranked (or engineer-selected) hypothesis |
| Supporting evidence citations | RCA Analyzer skill | Carried through into the report's evidence appendix |
| SOP/manual excerpt | Knowledge Base Search skill | Grounds the recommended action in an approved procedure where one exists |
| Incident metadata | Investigation Context Store | Incident ID, equipment, line/plant, downtime hours, malfunction/restoration timestamps |
| Similar historical cases and their corrective actions | Failure Pattern Matcher skill | Used to flag if a previously tried corrective action was ineffective |

## Output Format

```json
{
  "corrective_action_plan": {
    "immediate_action": "...",
    "preventive_action": "...",
    "owner_role": "Maintenance Engineer|Reliability Engineer|Planner",
    "target_timeframe": "..."
  },
  "rca_report": "<six-section markdown document, header 'AI-Generated Draft — Pending Maintenance Engineer Review'>"
}
```

## Examples

**Input:** Top-ranked root cause "Bearing lubrication starvation" (High confidence); Failure Pattern Matcher shows the same root cause on this pump 3 months earlier with corrective action "re-grease, no replacement" marked ineffective (failure recurred).

**Output (excerpt):**
```
Immediate Containment Action:
Verify lubrication reservoir level and grease condition on Pump P-301 before
return to service; run at reduced load for 2 hours with vibration monitoring
active before returning to full rate, per SOP-PM-0417 Section 4.2.
Owner: Maintenance Engineer. Timeframe: Before restart (complete).

Preventive Corrective Action:
Replace the bearing assembly (not re-grease only — the 2026-05-07 re-grease-
only action on this same pump did not prevent recurrence). Revise the
preventive maintenance lubrication interval for Pump P-301 and P-302 from
90 days to 45 days, and add an automated lubrication reminder tied to the
Historian vibration trend crossing 5.0 mm/s as an early-warning trigger.
Owner: Reliability Engineer. Timeframe: PM interval revision within 2 weeks;
automated trigger configuration within 4 weeks.
```

## Guardrails

- Never recommend a generic, non-equipment-specific action (e.g., "inspect equipment regularly") when a specific SOP/manual excerpt or root cause citation is available to ground a more specific recommendation.
- Always explicitly flag when the proposed corrective action is materially the same as a documented, later-ineffective past action on the same equipment/failure mode, and recommend escalation to design/engineering review in that case rather than repeating it silently.
- Keep the RCA report header "AI-Generated Draft — Pending Maintenance Engineer Review" until the orchestrating workflow confirms an engineer Approve action; this skill does not clear that flag itself.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
