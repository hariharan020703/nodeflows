# Implementation Guide: Spare Parts Intelligence Assistant

## Prerequisites

- **System access:** Read access to SAP MM (material master, stock, vendor master), write access scoped to purchase requisition creation only; read access to the Inventory Database analytical mart (or its equivalent staging layer, if not yet built); read access to ERP production plan and cost-center objects; read/write (RFQ submission) access to the Supplier Portal.
- **Data readiness:** Minimum 12 months of consumption history in SAP MM/Inventory Database for the pilot plant's active materials; criticality classification (Class A/B/C or equivalent) populated for the pilot's material catalog, or a plan to backfill it during Discovery.
- **Vendor data readiness:** Vendor catalog and OTIF performance data available either via a live Supplier Portal integration or, as an interim fallback, extracted from the SAP MM vendor master.
- **LLM platform access:** An approved enterprise LLM deployment (per `Plugin/plugin.json` deployment configuration) with data-processing approval for material descriptions, consumption quantities, and vendor pricing under existing data governance policy.
- **Organizational readiness:** Defined approval-tier mapping (Planner / Maintenance Engineer / Plant Manager) and its correspondence to SAP MM's release-strategy configuration.

## Phased Implementation Plan

| Phase | Duration | Key Activities | Deliverables |
|---|---|---|---|
| 1. Discovery | 3-4 weeks | Validate criticality classification coverage; confirm consumption-history data quality and depth; establish plant-specific stock-out/carrying-cost baselines; confirm Supplier Portal integration status; agree pilot plant(s) and material scope. | Discovery report with validated KPI baselines; pilot scope document; data-gap remediation plan. |
| 2. Data Integration | 4-6 weeks | Build/validate the Inventory Database staging tables (`dim_spare_part`, `fact_consumption`, `fact_stock_snapshot`, `fact_ai_spare_recommendation`); establish nightly SAP MM sync; connect ERP production-plan and cost-center feeds; integrate or configure interim fallback for Supplier Portal vendor data. | Working data pipeline validated against `Sample Data/` schema; data-quality dashboard. |
| 3. Skill/Model Build | 5-7 weeks | Implement tiered forecasting models (moving average/Croston's, Holt-Winters, LightGBM w/ failure-signal covariate); implement criticality-weighted inventory-optimization logic; build the embedding index and alternative-part matcher; implement vendor ranking and cost-optimization logic; integrate LLM explanation/drafting layer. | Four working skills passing unit tests against `Sample Data/`; embedding index populated from Supplier Portal/`alt_part_xref.csv`-equivalent data. |
| 4. Pilot | 6-8 weeks | Run in shadow mode against the pilot plant's live data; compare AI recommendations to planner decisions without auto-drafting write-backs; tune materiality thresholds and approval-tier rules; conduct UAT with Planner/Maintenance Engineer/Plant Manager. | Shadow-mode accuracy report; tuned configuration; UAT sign-off. |
| 5. Rollout | 4-6 weeks per additional plant | Activate write-back (draft requisition/RFQ generation with human approval) for the pilot plant; roll out to additional plants using the validated configuration, re-running Discovery-lite for each new plant's data quality. | Live plugin in production for pilot plant; rollout plan for subsequent plants. |

## Environment Setup

1. **Connector registration:** Register the SAP MM, Inventory Database, ERP, and Supplier Portal connectors in the target orchestration platform, using the auth methods specified in each `Connectors/` spec (OAuth 2.0 client credentials or managed identity as applicable).
2. **Credential provisioning:** Provision the `SVC_AI_SPAREPARTS` SAP service user (read-only material/stock, requisition-create-only write) and equivalent service principals for the Inventory Database, ERP, and Supplier Portal connectors via the organization's secrets-management platform (NFR-4). No credentials are stored in skill code or prompts.
3. **Sandbox validation:** Point all four connectors at sandbox/non-production instances first; validate the data flow end-to-end using `Sample Data/` as a synthetic substitute for any sandbox instance not yet populated with realistic data.
4. **Model deployment:** Deploy the forecasting models, embedding index build job, and inventory-optimization logic to the designated model-serving environment; configure the scheduled batch jobs (nightly consumption sync, nightly forecast refresh, daily embedding index refresh, monthly cost-center reconciliation).
5. **LLM configuration:** Configure the LLM orchestration layer with the retrieval-grounding constraints described in `Technical Design.md` (source-cited rationale generation, no unsupported claims) and the requisition/RFQ drafting templates.
6. **Approval-tier configuration:** Configure the approval-routing engine with the criticality-to-tier mapping and budget-fit threshold (default 10% of remaining cost-center budget triggers Plant Manager escalation), and map each tier to the corresponding SAP MM release-strategy step.
7. **Sandbox-to-production promotion:** After sandbox validation and UAT sign-off, promote connector configurations to production endpoints, re-validate credentials, and run the smoke test (see Validation section in `Plugin/PLUGIN_GUIDE.md`) against live (but still shadow-mode) production data before enabling write-back.

## Testing Strategy

- **Unit testing:** Each skill tested independently against `Sample Data/` — e.g., verifying the Spare Recommendation skill's model-tier selection logic produces the expected model choice for a low-volume vs. high-volume material, and that the Inventory Analyzer skill's safety-stock formula produces the expected numeric output for a known criticality class and consumption variability.
- **Integration testing:** End-to-end skill chain (Spare Recommendation → Inventory Analyzer → Vendor Recommendation → Cost Optimization) tested against the full `Sample Data/` set, confirming that a flagged stock-out risk on `SP-BRG-6205-2RS` at `PLANT-A` correctly produces a ranked vendor shortlist and a draft requisition with the expected approval tier (Maintenance Engineer, given Class A criticality).
- **UAT:** Planners, maintenance engineers, and plant managers review a batch of AI-generated recommendations and draft requisitions against their own manual assessment of the same materials, scoring agreement and flagging any recommendation they would not have approved as written.
- **Shadow-mode validation:** Run the full pipeline against live plant data for a minimum of 4-6 weeks with write-back disabled, logging every recommendation to `fact_ai_spare_recommendation` and comparing forecast accuracy (MAPE) and stock-out/overstock flag precision against what actually occurred, before enabling live requisition/RFQ drafting.
- **Regression testing:** Any change to the forecasting models, inventory-optimization formula, or embedding index similarity threshold is re-validated against the full `Sample Data/` set and a held-out sample of historical plant data to confirm no unintended shift in recommendation behavior.

## Change Management & Training Plan

| Audience | Training Focus | Format |
|---|---|---|
| Technicians | How consumption logging accuracy (correct material_id, correct work order reference) directly improves forecast quality; how to request an alternative-part lookup on demand. | 30-minute briefing plus quick-reference card. |
| Maintenance Planners | How to triage the daily/weekly AI recommendation queue; how to interpret forecast confidence and prediction intervals; when to override vs. accept a recommendation. | Half-day workshop with live system walkthrough using shadow-mode output. |
| Maintenance Engineers | How to evaluate flagged alternative-part substitutions requiring engineering sign-off; how criticality classification changes affect stocking policy. | Half-day workshop focused on the sign-off gate and criticality-classification review process. |
| Plant Managers | How to interpret budget-fit escalations and cost-of-action/cost-of-inaction framing; KPI dashboard review cadence. | 1-hour executive briefing plus monthly KPI review cadence. |
| Procurement/Buyers | How AI-drafted requisitions/RFQs enter the existing SAP MM/Supplier Portal workflow; how to provide feedback that improves future vendor ranking. | 1-hour workshop coordinated with Procurement leadership. |

## Go-Live Checklist

- [ ] Criticality classification populated for at least 95% of the pilot plant's active spare-part catalog.
- [ ] 12+ months of consumption history validated and loaded into the Inventory Database staging tables.
- [ ] All four connectors validated in production with correct read/write scope (confirmed via a permissions audit, not just a successful test call).
- [ ] Shadow-mode run completed for a minimum of 4-6 weeks with forecast accuracy and flag-precision results reviewed and accepted by the Business Owner.
- [ ] Approval-tier routing configuration tested against Class A/B/C and in-budget/over-threshold scenarios (per the acceptance criteria in `Business Requirements.md`).
- [ ] UAT sign-off obtained from Planner, Maintenance Engineer, and Plant Manager representatives.
- [ ] Audit logging confirmed operational — every recommendation and approval decision verified to appear in the log within the batch cycle.
- [ ] Escalation/timeout handling for pending approvals tested (default 48-hour SLA for Class A stock-out-risk items).
- [ ] Rollback plan (see `Plugin/PLUGIN_GUIDE.md`) reviewed and confirmed executable within the defined RTO.
- [ ] Training completed for all five stakeholder audiences listed above.

## Post-Go-Live Support Model

- **Monitoring:** Automated monitoring of connector health (latency, error rate), forecast accuracy (rolling MAPE by material/plant), and approval-queue SLA compliance, surfaced on a dashboard reviewed weekly by the Manufacturing AI Platform Lead.
- **Escalation:** Connector failures or data-quality anomalies (e.g., a spike in data-quality-flagged consumption records) trigger an alert to the Technical Owner; recommendation-quality concerns raised by Planners/Engineers are logged and reviewed in a bi-weekly model-performance review.
- **Continuous improvement cadence:** Monthly review of forecast accuracy and recommendation-acceptance rate by material criticality class; quarterly re-evaluation of the criticality-to-service-level mapping and carrying-cost rate assumptions against actual finance data; embedding index and vendor catalog refreshed continuously per the connector's integration pattern, with a quarterly audit of alternative-part match quality against engineering feedback.
- **Model retraining:** Forecasting models retrained on a quarterly cadence, or immediately following a material data-generating event (e.g., a major process change affecting consumption patterns), with champion/challenger evaluation before promoting a retrained model to production.
