---
name: checklist-generator
description: Generates the specific, step-by-step preventive maintenance task checklist a technician will follow at the equipment, tailored to the asset's OEM specification, criticality class, and the specific interval milestone being performed. Use when a PM task has been scheduled (and optionally resourced) and a technician needs a fresh, OEM- and SOP-grounded checklist rather than a generic or outdated paper checklist.
---

# Checklist Generator

Replaces generic, often outdated paper checklists with a checklist assembled fresh from the current OEM manual and the plant's own SOP library. For example, a 2,000-hour vs. a 10,000-hour service on the same pump may require different steps — this skill resolves the correct milestone-specific procedure rather than reusing a one-size-fits-all list.

## Instructions

1. **Resolve the applicable OEM procedure.** Match `equipment_id` to manufacturer/model, then retrieve the specific OEM maintenance manual section for the interval milestone being performed (e.g., "2,000-hour service" vs. "10,000-hour major overhaul") via retrieval over the OEM manual corpus, using the equipment's exact model/serial to disambiguate manual revisions.
2. **Overlay plant-specific requirements.** Merge in mandatory plant SOP steps that are not in the OEM manual but are required locally (e.g., a specific lockout/tagout (LOTO) sequence, an environmental containment step, a QA sign-off step for food-grade or pharma lines), inserting them at the correct sequence position rather than appending them at the end.
3. **Incorporate reliability feedback.** Cross-reference maintenance history for this asset/asset-class: if a specific step has a history of being skipped and subsequently correlating with early failure notifications, mark that step "Do Not Skip — Historical Failure Correlation" with a one-line citation of the correlating incident count.
4. **Sequence and format.** Order steps logically (isolate/LOTO → inspect → service → test/verify → restore → sign-off), attach a required tools/parts list, and attach the estimated duration per step (feeding back into the Resource Planner skill's duration estimates).
5. **Attach safety and compliance flags.** Explicitly flag any step requiring a permit (hot work, confined space, working at height, electrical isolation) so the technician and supervisor see permit requirements before the visit, not on arrival.
6. **Render output** in the format required by the delivery channel — structured JSON for a work-order long text field or a Teams adaptive card checklist, or a printable format for offline/no-connectivity plant-floor use.

## Inputs

| Input | Source | Fields Used |
|---|---|---|
| Scheduled PM task | Maintenance Scheduler / Resource Planner skill output | `equipment_id`, `task_type`, `interval_utilization_at_schedule`, asset `criticality` |
| Equipment master & OEM documentation | SAP PM Equipment Master (IE03) + OEM manual library | Manufacturer, model, functional location, applicable OEM service bulletin/manual section |
| Plant-specific SOP overlays | SOP repository | LOTO procedure references, plant-specific torque specs, safety overlays that supersede or supplement OEM defaults |
| Prior checklist completion data | SAP PM Order confirmations / SQL Database `fact_maintenance_history` | Historically flagged steps (frequently skipped, frequently generating follow-up notifications) |

## Output Format

```json
{
  "plan_id": "PM-20415",
  "equipment_id": "EQ-30012",
  "checklist": [
    {"step_number": 1, "step_description": "Lock out and tag out per Plant LOTO Procedure LOTO-UTIL-04; verify zero energy state on compressor motor circuit.", "safety_flag": "LOTO Permit Required", "estimated_minutes": 15},
    {"step_number": 4, "step_description": "Inspect and clean condenser tubes; verify against OEM fouling-factor threshold in Manual Rev. 7, Section 4.3.", "estimated_minutes": 45, "source_citation": "OEM Manual CH-Series Rev.7 §4.3"},
    {"step_number": 6, "step_description": "Verify refrigerant charge and check for leaks at flare fittings — DO NOT SKIP: correlated with 3 prior unplanned refrigerant-loss notifications when omitted.", "safety_flag": "Refrigerant Handling Cert Required", "estimated_minutes": 30, "source_citation": "fact_maintenance_history: NOTIF-88213, NOTIF-90041, NOTIF-91560"}
  ]
}
```

Also produce:
- A permit-requirement summary for the task (if any).
- "Do Not Skip" flags with historical-incident citation for reliability-critical steps.

## Examples

**Input (excerpt):**
```json
{
  "equipment_id": "EQ-30012",
  "description": "Chiller CH-1 - Plant Cooling",
  "task_type": "4000-hr Preventive Service",
  "criticality": "Critical"
}
```

**Output:** see the Output Format example above (`PM-20415`).

## Guardrails

- Never omit a manufacturer-mandated safety step (LOTO, permit, PPE) even if a plant SOP overlay does not explicitly repeat it — safety steps are additive, never subtractive, across OEM and plant sources.
- Every checklist step sourced from a document must carry a source citation (manual name, revision, section); steps without a traceable source must be labeled "Plant SOP Addition" rather than presented as OEM-derived.
- If the OEM manual for a given model/serial cannot be retrieved with confidence, flag the checklist as "Unverified — Generic Template Used" rather than fabricate OEM-specific torque values or tolerances.
- Do not alter or remove a "Do Not Skip" historical-failure flag without a Maintenance Engineer's explicit override, logged with a reason code.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
