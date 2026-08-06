---
name: vendor-recommendation
description: Identifies and ranks qualified vendors for a spare-part procurement need, and finds functionally equivalent alternative parts when the primary material is unavailable or lead time is unacceptable, balancing price, lead time, minimum order quantity, and delivery reliability (OTIF). Use whenever a procurement action is identified for a spare part, or a technician or planner asks directly for an out-of-stock alternative.
---

# Vendor Recommendation

## Instructions

1. **Look up primary-material vendors.** Query the vendor catalog for all vendors carrying the requested `material_id`.
2. **Check availability.** If no vendor can meet `required_date` given their `lead_time_days`, or the primary material has zero qualified vendors, proceed to alternative-part matching (step 5). Otherwise continue to ranking.
3. **Rank candidate vendors** on a weighted composite score: `score = (0.4 x normalized_price_advantage) + (0.35 x otif_rate) + (0.25 x normalized_lead_time_advantage)`. For Class A materials, shift the weighting toward reliability: `0.25 x price, 0.5 x OTIF, 0.25 x lead time`, since a missed delivery on a critical part is costlier than a price difference.
4. **Check MOQ feasibility.** Discard or flag any vendor whose `moq` would force over-ordering beyond the recommended max stock by more than 50%, unless no compliant alternative exists.
5. **Match alternative parts (embedding-based)** when invoked for an out-of-stock or no-qualified-vendor scenario: embed the primary material's description/spec attributes and compare (cosine similarity) against the embedding index built from the alternative-part cross-reference catalog and vendor catalog descriptions. Surface only candidates at or above 0.85 similarity; below that, state that no confident match was found rather than guessing.
6. **Validate compatibility.** For each embedding-matched candidate, retrieve the vendor's own compatibility notes and any dimensional/spec fields. Flag any match that requires engineering sign-off (e.g. noted as "reprogramming required" or "firmware/program compatibility check required") as **not** auto-approvable, even at a high similarity score.
7. **Cross-check against ERP.** Where the ERP-held purchasing info record's price/lead-time diverges from the live Supplier Portal quote by more than 15%, surface both figures rather than resolving silently.
8. **Package the recommendation.** Present a ranked shortlist (primary vendors first, then alternative-part vendors if applicable) with scoring rationale, for either automatic RFQ submission (non-critical, pre-approved vendor) or planner review (critical or novel-vendor scenarios).

## Inputs

- `material_id`, `quantity`, `required_date`, `plant` — required.
- Vendor catalog: `vendor_id`, `price`, `moq`, `lead_time_days`, `otif_rate`.
- Alternative-part cross-reference: `alternative_id`, `alternative_source`, `compatibility_notes`, `similarity_score`.
- Spare part master: `criticality_class`, `description`.
- ERP purchasing info record (cross-check): `Price`, `LeadTimeDays`.

## Output Format

Return a JSON object with: `material_id`, `criticality_class`, `primary_vendor_shortlist` (array of vendor objects with `vendor_id`, `vendor_name`, `price`, `lead_time_days`, `moq`, `otif_rate`, `composite_score`, `meets_required_date`), `recommendation` (plain-language), and `alternative_parts_considered` (boolean, plus the alternative-part shortlist and sign-off flags when true).

## Examples

**Input:**
```json
{
  "material_id": "SP-VALVE-SOLENOID-24V",
  "quantity": 6,
  "required_date": "2026-08-20",
  "plant": "PLANT-C"
}
```

**Output:**
```json
{
  "material_id": "SP-VALVE-SOLENOID-24V",
  "criticality_class": "A",
  "primary_vendor_shortlist": [
    {"vendor_id": "VEND-1002", "vendor_name": "Motion & Automation Components", "price": 132.00, "lead_time_days": 11, "moq": 1, "otif_rate": 0.97, "composite_score": 0.93, "meets_required_date": true},
    {"vendor_id": "VEND-1007", "vendor_name": "Electrical Controls Distributor", "price": 141.75, "lead_time_days": 14, "moq": 1, "otif_rate": 0.90, "composite_score": 0.78, "meets_required_date": false}
  ],
  "recommendation": "VEND-1002 — meets the 2026-08-20 requirement with 5 days of buffer, highest OTIF (97%) among qualified vendors, and lowest price. VEND-1007's 14-day lead time would miss the required date by 3 days.",
  "alternative_parts_considered": false
}
```

## Guardrails

- Never present an embedding-matched alternative part below the 0.85 similarity threshold as a recommendation; state "no confident alternative found — recommend manual sourcing" instead.
- Never auto-approve a substitute flagged as requiring reprogramming, firmware compatibility checks, or engineering sign-off — always route these to human review regardless of similarity score or urgency.
- Surface conflicting price/lead-time data between ERP and live Supplier Portal quotes rather than silently picking one source.
- RFQ submission (a write action) always requires that price, lead time, and required date be populated from verified source data — never from an LLM-inferred default.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
