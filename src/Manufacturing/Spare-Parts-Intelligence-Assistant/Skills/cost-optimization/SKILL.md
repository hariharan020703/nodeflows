---
name: cost-optimization
description: Evaluates the total-cost-of-ownership trade-off between stocking, procurement, and stock-out risk for a spare part in dollar terms, checks budget fit against the cost center, and drafts the resulting purchase requisition for human approval. Use when an inventory-analyzer stock-out or overstock flag needs to be turned into a dollar-quantified action recommendation, or a procurement request needs to be drafted and routed for sign-off.
---

# Cost Optimization

## Instructions

1. **Estimate stock-out cost.** For any material flagged at stock-out risk, estimate `P(stock-out) x downtime_hours_if_unavailable x plant_downtime_cost_per_hour`, using plant-specific downtime cost benchmarks where available, or an industry-illustrative range where they are not yet supplied — always label which basis was used.
2. **Estimate carrying cost.** Use the upstream annualized carrying-cost exposure for any overstock flag as the counter-weight in the trade-off.
3. **Check for order consolidation.** Scan pending/near-term procurement needs across materials sharing a vendor and required-date window. Where consolidating into a single PO would clear a vendor's MOQ more efficiently or unlock a price break, flag the consolidation opportunity explicitly rather than issuing multiple small requisitions. Never delay a time-critical individual requisition waiting on a consolidation opportunity that may not materialize in time.
4. **Check budget fit.** Compare the total cost of the proposed procurement action against the maintenance/MRO cost center's remaining budget for the period. If the action would consume more than 10% (default, configurable) of remaining budget in a single transaction, flag for plant-manager-level approval rather than planner-level. A budget flag escalates — it never silently blocks a legitimately urgent action.
5. **Frame the recommendation.** For stock-out-risk materials, frame as "cost of inaction" (expected stock-out cost) vs. "cost of action" (procurement cost now). For overstock materials, frame as avoidable carrying cost vs. disposition cost (return-to-vendor fee, if any).
6. **Draft the procurement request.** For approved-path recommendations (pre-approved vendor, in-budget, non-novel material), draft the purchase requisition payload (Material, Plant, Quantity, Required Date, Requester, Justification), generating the `Justification` string from the upstream forecast/vendor rationale — never from a generic template.
7. **Route for approval.** Route the draft requisition to the appropriate human approver tier based on criticality class and budget-fit outcome: planner for routine/in-budget Class B/C; maintenance engineer plus plant manager for Class A or budget-flagged items. This skill drafts — it never commits spend itself.

## Inputs

- Inventory health record (from inventory-analyzer): computed min/max, stock-out risk flag, overstock flag, carrying-cost exposure.
- Vendor shortlist (from vendor-recommendation): ranked vendors, price, lead time, MOQ.
- Spare part master: `unit_cost_usd`, `criticality_class`.
- Cost center budget (from ERP): `CostCenterID`, `Budget`, `ActualSpend`, `Period`.
- Historical stock-out impact (optional): downtime hours attributable to prior parts unavailability.

## Output Format

Return a JSON object with: `material_id`, `cost_of_inaction_usd_estimate` (with basis stated), `cost_of_action_usd`, `recommended_vendor`, `budget_fit`, `consolidation_opportunity`, `draft_requisition` (Material, Plant, Quantity, RequiredDate, Requester, Justification), and `approval_tier_required`.

## Examples

**Input:**
```json
{
  "material_id": "SP-BRG-6205-2RS",
  "plant": "PLANT-A",
  "flag": "stock_out_risk",
  "days_of_cover_remaining": 12,
  "recommended_order_qty": 14
}
```

**Output:**
```json
{
  "material_id": "SP-BRG-6205-2RS",
  "cost_of_inaction_usd_estimate": "18,000-93,600 (assuming 1-4 hours unplanned conveyor downtime at $50k-$260k/hr industry-illustrative benchmark, weighted by historical stock-out frequency for this part)",
  "cost_of_action_usd": 250.60,
  "recommended_vendor": "VEND-1001 (Bearing & Power Transmission Supply Co) — $17.90/unit, 9-day lead time, 96% OTIF",
  "budget_fit": "Within cost center MAINT-PLANT-A Q3 budget; consumes 0.4% of remaining quarterly spares budget",
  "consolidation_opportunity": "None — no other near-term VEND-1001 orders pending for PLANT-A",
  "draft_requisition": {
    "Material": "SP-BRG-6205-2RS",
    "Plant": "PLANT-A",
    "Quantity": 14,
    "RequiredDate": "2026-08-14",
    "Requester": "AI_SPAREPARTS_AGENT",
    "Justification": "12 days of cover remain against a 10-day vendor lead time on a Class A bearing with rising consumption trend (Spare Recommendation forecast: 11 units/quarter, up from 3/quarter in early 2025). Recommended vendor VEND-1001 offers lowest price and 96% OTIF within the required window."
  },
  "approval_tier_required": "Maintenance Engineer (Class A material)"
}
```

## Guardrails

- Never submit a purchase requisition without routing through the criticality-appropriate human approval tier — this skill drafts, it does not commit spend.
- Always show the assumption basis for a stock-out cost estimate (industry-illustrative benchmark vs. plant-specific historical data) rather than presenting a single number as if empirically certain.
- Budget-fit flags escalate rather than block — a legitimately urgent Class A procurement is never silently held for budget reasons; it is escalated to the plant manager for a fast decision.
- Never delay a time-critical individual requisition to wait for an order-consolidation opportunity that may not materialize in time.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.
