# Plugin Guide: Spare Parts Copilot

## 1. Purpose

Machine repairs are delayed because spare parts are unavailable, overstocked, or incorrectly selected — the result of static, rarely-revisited stocking parameters, default-vendor reordering, and tribal-knowledge-only substitute-part identification. The Spare Parts Copilot addresses this by continuously forecasting spare-part consumption per material/plant, computing criticality-weighted inventory levels (safety stock, reorder point, min/max), ranking vendors and identifying viable alternative parts when the primary material is unavailable, and drafting the resulting procurement requests — purchase requisitions and RFQs — for human approval. The goal is to shift spares management from reactive and static to forecast-driven and criticality-aware, reducing both critical-part stock-outs and capital tied up in excess inventory.

This plugin's Skills and Connectors now follow Claude's real Agent Skills and MCP formats (see `Skills/`, `Connectors/`, and `Plugin/.claude-plugin/plugin.json`), rather than an earlier invented schema.

## 2. Prerequisites

- **SAP MM:** A service account (`SVC_AI_SPAREPARTS`) with read access to material master (MM03) and stock overview (MMBE) views, and write access scoped exclusively to purchase requisition creation (ME51N equivalent) — no PO release or financial posting authority.
- **Inventory Database:** A read-only analytics role for `dim_spare_part`, `fact_consumption`, and `fact_stock_snapshot`, plus a narrowly scoped write role limited to `fact_ai_spare_recommendation`.
- **ERP:** A read-only service principal scoped to production plan and cost-center objects.
- **Supplier Portal:** OAuth 2.0 client credentials scoped to the organization's buyer account, with read access to vendor catalog and alternative-part cross-reference data and write access limited to RFQ submission.
- **LLM/model platform access:** Access to the organization's approved enterprise LLM deployment and an embedding endpoint for the alternative-part matcher, both approved for processing material description, consumption, and vendor pricing data under existing data governance policy.
- **Organizational configuration:** A defined approval-tier mapping (Planner / Maintenance Engineer / Plant Manager) and its correspondence to SAP MM's release-strategy configuration, established before installation.

## 3. Installation Steps

1. **Add the marketplace (or local path) that hosts this plugin:** `/plugin marketplace add <org>/<repo>` (or a local path such as this repository's `04-Spare-Parts-Intelligence-Assistant/Plugin` during development/pilot).
2. **Install the plugin:** `/plugin install spare-parts-copilot@<marketplace-name>`. Claude Code/Cowork reads `Plugin/.claude-plugin/plugin.json`, registers the four MCP servers declared in `Plugin/.mcp.json` (sap-mm, inventory-database, erp, supplier-portal), and loads the skill folders under `Skills/` (`spare-recommendation`, `inventory-analyzer`, `vendor-recommendation`, `cost-optimization`).
3. **Provide the required environment variables** for each MCP server's `authorization_token` before or during install, per each connector's `mcp-server.json` — `SAP_MM_MCP_TOKEN`, `INVENTORY_DATABASE_MCP_TOKEN`, `ERP_MCP_TOKEN`, `SUPPLIER_PORTAL_MCP_TOKEN` — sourced from the organization's secrets-management platform (managed identity or equivalent vault); never hardcode a token value in `.mcp.json` or a skill file.
4. **Confirm each MCP server starts successfully** (Claude Code/Cowork will report connection status per server); a server that fails to start makes its tools (see each connector's `tools.json`) unavailable to the skills until the credential or network issue is resolved.
5. **Confirm the four skills are available** — they trigger automatically when their `SKILL.md` `description` matches a request, or can be invoked directly via `/spare-recommendation`, `/inventory-analyzer`, `/vendor-recommendation`, `/cost-optimization`.
6. Deploy the forecasting models (moving average/Croston's, Holt-Winters, LightGBM), the criticality-weighted inventory-optimization logic, and the embedding index build job to the organization's model-serving environment, per the Model/AI Approach section of `Technical Design.md`.
7. Configure the batch/event schedules that drive this plugin (nightly consumption/forecast sync, daily embedding index refresh, monthly cost-center reconciliation, reorder-point-breach event trigger, and upstream failure-prediction signal ingestion from the Predictive Maintenance Assistant plugin, if installed) in the orchestration platform's own scheduler — these are operational schedules external to the plugin manifest, documented in `Technical Design.md`'s Data Flow section.
8. Configure the approval-routing engine with the criticality-to-tier mapping and budget-fit threshold (see Configuration Reference below), and map each approval tier to the corresponding SAP MM release-strategy step.
9. Run the plugin in sandbox/shadow mode (MCP write tools — `sap_mm_create_purchase_requisition`, `supplier_portal_submit_rfq`, `inventory_db_log_ai_recommendation` — disabled or pointed at a non-production endpoint) against `Sample Data/` first, then against live but non-write-enabled plant data, before activating write-back per the Environment Setup steps in `Implementation Guide.md`.
10. Activate the plugin for the pilot plant once shadow-mode validation and UAT sign-off are complete.

## 4. Configuration Reference

| Parameter | Description | Default |
|---|---|---|
| `materiality_threshold_pct` | Minimum % delta between a new recommendation and the current SAP MM min/max required to flag for planner review rather than auto-log as FYI. | 20% |
| `service_level_class_a` / `class_b` / `class_c` | Target service level used in the safety-stock formula, by criticality class. | 98% / 95% / 90% |
| `criticality_multiplier_class_a` / `class_b` / `class_c` | Multiplier applied to computed safety stock, by criticality class. | 1.5x / 1.2x / 1.0x |
| `overstock_threshold_pct` | % above computed max stock, combined with low trailing consumption, required to trigger an overstock flag. | 25% |
| `carrying_cost_rate_pct` | Annualized carrying cost rate applied to excess inventory value. | 22% |
| `alt_part_similarity_threshold` | Minimum cosine similarity for an embedding-matched alternative part to be presented as a candidate. | 0.85 |
| `budget_fit_escalation_pct` | % of remaining cost-center period budget a single procurement action can consume before requiring Plant Manager approval instead of Planner/Maintenance Engineer. | 10% |
| `approval_sla_hours_class_a` | Hours before a pending Class A approval triggers an escalation reminder. | 48 |
| `stale_cache_warning_hours` | Hours before cached ERP/Supplier Portal data triggers a staleness warning instead of silent use. | 48 |
| `forecast_min_history_events` | Minimum historical consumption events required before a forecast is given full (non-low-confidence) status. | 3 |

## 5. Validation / Smoke Test

Use `Sample Data/spare_part_master.csv`, `consumption_history.csv`, `vendor_catalog.csv`, and `alt_part_xref.csv` to run the following end-to-end scenario before go-live:

1. **Forecast check:** Invoke the Spare Recommendation skill for `material_id=SP-BRG-6205-2RS`, `plant=PLANT-A`. Confirm the output identifies a Holt-Winters or moving-average model (given 6 historical events), returns a 3-month forecast in the range of the historical quarterly consumption trend (3-5 units), and cites specific `work_order_ref` values from `consumption_history.csv`.
2. **Inventory policy check:** Invoke the Inventory Analyzer skill for the same material. Confirm the computed reorder point and min/max reflect the Class A service level (98%) and 1.5x criticality multiplier, and that the delta versus the current `min_stock=8`/`max_stock=24` is correctly flagged for review if it exceeds the 20% materiality threshold.
3. **Overstock check:** Invoke the Inventory Analyzer skill for `material_id=SP-GASKET-FLNG-DN50`, `plant=PLANT-B`, with a synthetic `on_hand_qty=96`. Confirm an overstock flag is raised with a quantified annualized carrying-cost figure consistent with the $3.85/unit cost in `spare_part_master.csv` and the 22% default carrying-cost rate.
4. **Vendor ranking check:** Invoke the Vendor Recommendation skill for `material_id=SP-VALVE-SOLENOID-24V`, quantity 6, required date within 14 days. Confirm both `VEND-1002` and `VEND-1007` from `vendor_catalog.csv` are considered, and that `VEND-1002` is ranked higher given its lower price, shorter lead time, and higher OTIF.
5. **Alternative-part check:** Simulate an out-of-stock scenario for `material_id=SP-VFD-15KW` with no vendor able to meet the required date. Confirm the skill returns `VND-ABB-ACS580-15KW` from `alt_part_xref.csv` flagged as `requires_engineering_signoff = true` (per its "reprogramming required" compatibility note) rather than auto-approving it.
6. **Requisition draft check:** Invoke the Cost Optimization skill for the `SP-BRG-6205-2RS` stock-out scenario. Confirm the draft purchase requisition payload matches the SAP MM connector's required shape, the `Requester` field is set to the service account identifier (never a human name), and the `Justification` string cites specific forecast/vendor data rather than generic language.
7. **Audit trail check:** Confirm all five preceding invocations produced a corresponding entry in the `fact_ai_spare_recommendation` audit table with `model_version` populated, regardless of whether any write-back occurred.

The plugin passes the smoke test when all seven checks produce the expected output and no write action occurs without a corresponding logged human approval step (verified by attempting to approve/reject each draft requisition/RFQ in the sandbox approval queue).

## 6. Rollback Plan

1. **Disable write-back first:** Immediately disable or point-away-from-production the MCP write tools (`sap_mm_create_purchase_requisition` in `Connectors/sap-mm/tools.json`, `supplier_portal_submit_rfq` in `Connectors/supplier-portal/tools.json`), reverting the plugin to shadow/analysis-only mode without a full uninstall. This is the fastest safe response to any recommendation-quality concern.
2. **Disable scheduled triggers:** Pause the nightly/daily/monthly scheduled jobs configured in the orchestration platform's own scheduler (see Installation Steps, item 7) to stop new recommendation generation while the issue is investigated.
3. **Preserve the audit trail:** Do not delete or modify `fact_ai_spare_recommendation` entries during rollback — they remain the record of what was recommended and are needed for root-cause analysis.
4. **Revert connector credentials if compromised:** If rollback is triggered by a credential or security concern, revoke and rotate the affected MCP server's `authorization_token` env var via the secrets-management platform immediately, independent of the plugin-level disable.
5. **Full uninstall (if required):** Run `/plugin uninstall spare-parts-copilot`; the underlying SAP MM, Inventory Database, ERP, and Supplier Portal systems are unaffected, since this plugin never held sole ownership of any transactional data — all system-of-record data remains intact and independently usable.
6. **Re-activation:** After remediation, re-enable in shadow mode first (per step 1, reversed) and re-run the Validation/Smoke Test before re-enabling write-back.

## 7. Reusability Notes

The four skills in this plugin are designed to generalize well beyond Maintenance's spare-parts use case:

- **Spare Recommendation**'s tiered forecasting pattern (data-volume/criticality-driven model selection, optional failure-signal covariate) is directly reusable by Production (packaging/consumables forecasting) and Facilities (HVAC filter, lighting, and general facilities-consumable forecasting) — only the consumption data source and the optional exogenous signal need to be re-mapped.
- **Inventory Analyzer**'s criticality-weighted safety-stock/reorder-point formula and overstock/carrying-cost detection logic is a general inventory-science pattern reusable by Procurement (broader MRO inventory optimization) and Production Planning (raw material/WIP buffer sizing), by re-parameterizing the criticality taxonomy and carrying-cost rate.
- **Vendor Recommendation**'s multi-criteria vendor scoring and embedding-based alternative-matching-with-compatibility-gate pattern is reusable by Procurement for general indirect/direct sourcing decisions and by any department managing multi-vendor categories with substitution complexity.
- **Cost Optimization**'s cost-of-action-vs-cost-of-inaction framing, budget-fit checking, and criticality/budget-gated approval routing is a general procurement-decision pattern reusable across any department with a tiered ERP/SAP approval hierarchy.

The four connectors (SAP MM, Inventory Database, ERP, Supplier Portal) are already declared reusable across departments in their canonical `Shared-Library/Connectors/` specs; this plugin's specific contribution is the spare-parts-domain skill logic layered on top of them, which can be forked and re-parameterized for a new department's inventory category without needing to rebuild the connector integrations from scratch.
