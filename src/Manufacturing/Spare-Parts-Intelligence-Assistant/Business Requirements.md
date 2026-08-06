# Business Requirements: Spare Parts Intelligence Assistant

## Objective

Deploy an AI-assisted spare-parts intelligence capability that forecasts spare-part consumption, recommends criticality-weighted inventory levels, identifies viable alternative parts when the primary material is unavailable, and drafts procurement requests for human approval — reducing critical-part stock-outs and their associated repair delays while reducing capital tied up in excess/slow-moving inventory.

## In-Scope

- Demand forecasting for spare parts at the material/plant granularity, using SAP MM/Inventory Database consumption history and, where available, upstream failure-prediction signals.
- Criticality-weighted computation of safety stock, reorder point, and min/max stocking parameters.
- Stock-out risk and overstock/slow-mover detection with quantified financial exposure (stock-out cost estimate, carrying cost estimate).
- Multi-vendor comparison (price, lead time, MOQ, OTIF) for procurement decisions.
- Embedding-based alternative/substitute-part identification against internal and vendor catalog cross-references, with a human sign-off gate for engineering-sensitive substitutions.
- Automated drafting (not submission without approval) of SAP MM purchase requisitions and Supplier Portal RFQs, with LLM-generated, source-cited justification text.
- Full audit logging of every AI-generated recommendation, whether or not actioned.
- Plants and materials within the pilot scope defined during Discovery (see `Implementation Guide.md`), with a path to broader plant rollout.

## Out-of-Scope

- Direct, unattended purchase order release or vendor payment — PO release and payment remain human-approved SAP MM/ERP actions outside this plugin's write scope.
- Physical warehouse operations (bin location optimization, cycle counting, physical receiving) — this remains the responsibility of the WMS and warehouse team.
- Capital equipment procurement (new machine purchases) — this use case addresses MRO/spare-parts inventory only, not capital asset acquisition.
- Contract negotiation or long-term vendor agreement management — the Vendor Recommendation skill compares existing catalog/quote data; it does not negotiate terms.
- Financial postings, invoice matching, or accounts-payable processes — out of scope for this plugin; these remain ERP/AP functions.

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | The system shall forecast forward spare-part consumption (1, 3, and 12-month horizons) per `material_id`/`plant` combination using historical consumption data, selecting a forecasting method appropriate to the material's data volume and criticality class. |
| FR-2 | The system shall incorporate an upstream equipment failure-prediction signal (from the Predictive Maintenance Assistant use case) as an exogenous forecasting input where such a signal is available for the equipment associated with a spare part. |
| FR-3 | The system shall compute a criticality-weighted safety stock, reorder point, and recommended min/max stocking band for every active material, differentiated by Class A/B/C criticality service-level targets. |
| FR-4 | The system shall flag any material whose current on-hand position, net of open orders, falls below its computed reorder point, and shall state the remaining days of cover. |
| FR-5 | The system shall flag any material whose on-hand position exceeds its computed max stock by more than 25% combined with low trailing-12-month consumption velocity, and shall quantify the annualized carrying-cost exposure of the excess. |
| FR-6 | The system shall retrieve and rank qualified vendors for a given material on a composite score of price, lead time, minimum order quantity feasibility, and on-time-in-full (OTIF) delivery performance, with weighting adjusted by criticality class. |
| FR-7 | When no qualified vendor can meet the required delivery date for the primary material, or no vendor carries the primary material, the system shall identify candidate alternative/substitute parts using embedding-based similarity matching against the alternative-part cross-reference catalog, presenting only matches at or above a defined similarity threshold. |
| FR-8 | The system shall flag any alternative-part match that carries a vendor- or engineering-noted compatibility caveat (e.g., reprogramming, firmware, or dimensional verification required) as requiring human engineering sign-off before it can be treated as auto-approvable. |
| FR-9 | The system shall quantify, for every stock-out-risk or overstock flag, the estimated dollar cost of action versus cost of inaction, and shall check the proposed procurement action against the relevant maintenance/MRO cost center's remaining budget for the period. |
| FR-10 | The system shall draft a purchase requisition (or vendor RFQ) payload with an LLM-generated justification citing the specific consumption, forecast, and vendor data used, whenever a procurement action is recommended. |
| FR-11 | The system shall route every draft requisition/RFQ to a criticality- and budget-fit-determined human approval tier (Planner, Maintenance Engineer, or Plant Manager) before submission to SAP MM or the Supplier Portal. |
| FR-12 | The system shall log every generated recommendation — forecast, inventory-policy change, vendor ranking, alternative-part match, and cost analysis — to the Inventory Database's recommendation audit table, whether or not the recommendation is ultimately actioned. |
| FR-13 | The system shall allow a maintenance engineer, planner, or plant manager to query the assistant directly (e.g., "what's the forecast for material X at plant Y," "find an alternative for material Z") via the Prompt Library's user-facing prompts, independent of the scheduled analysis cycle. |

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Forecast and inventory-policy computation for a single material/plant shall complete within 5 seconds for on-demand queries; full-plant batch re-scoring shall complete within 30 minutes for a plant's full active material catalog. |
| NFR-2 | The plugin shall achieve at least 99.0% availability during business hours for on-demand skill invocations, with scheduled batch jobs tolerant of a single retry within a 4-hour window on failure. |
| NFR-3 | All write actions to SAP MM (purchase requisition creation) and the Supplier Portal (RFQ submission) shall require an explicit human approval step; no write action shall be executed autonomously regardless of confidence score. |
| NFR-4 | All connector credentials shall be managed via the organization's secrets-management platform (e.g., managed identity, Azure Key Vault, or equivalent) with no credentials embedded in skill code or prompts. |
| NFR-5 | Data residency for all consumption, stock, and vendor data processed by this plugin shall remain within the organization's designated regional data boundary (per the deploying plant's data residency policy), including any staging layers used for model inference. |
| NFR-6 | Every AI-generated recommendation, forecast, and drafted procurement document shall include a plain-language rationale citing the specific source records used; the system shall not present a numeric recommendation without an accompanying, source-grounded explanation. |
| NFR-7 | All AI-generated recommendations, human approval/rejection decisions, and resulting write-backs shall be logged with timestamp, user, and model version for audit, retained per the organization's records-retention policy (minimum 3 years for procurement-related records). |
| NFR-8 | The embedding-based alternative-part matcher shall achieve a similarity-threshold precision such that no match below 0.85 cosine similarity is presented as a recommendation without an explicit "low-confidence" label. |
| NFR-9 | The system shall degrade gracefully when an upstream connector (SAP MM, ERP, Supplier Portal) is unavailable — falling back to last-cached data with a visible as-of timestamp rather than failing the entire recommendation pipeline. |

## Data Requirements

| Data Domain | Source | Frequency | Quality Expectations |
|---|---|---|---|
| Material master (description, criticality class, current min/max, lead time) | SAP MM / Inventory Database `dim_spare_part` | Daily batch sync; on-demand read for live checks | Criticality class must be populated for all active materials before pilot go-live; unclassified materials default to Class B pending review. |
| Consumption history | SAP MM / Inventory Database `fact_consumption` | Daily batch sync | Minimum 12 months of history required for standard forecasting confidence; records with implausible (negative/outlier) quantities excluded and flagged. |
| Stock snapshot | SAP MM (live) / Inventory Database `fact_stock_snapshot` | Live read for critical checks; daily snapshot for analytics | Snapshot staleness beyond 24 hours triggers a live SAP MM read before any stock-out determination. |
| Vendor catalog (price, MOQ, lead time, OTIF) | Supplier Portal | Live read on demand; cached with as-of timestamp | OTIF rate must be calculated over a rolling 12-month window per vendor; vendors with fewer than 5 historical orders flagged as "insufficient history for reliable OTIF." |
| Alternative-part cross-reference | Supplier Portal | Live read on demand | Compatibility notes field mandatory for any cross-reference entry to be eligible for the alternative-matching skill. |
| Production plan | ERP | Daily batch sync | Staging cache older than 48 hours triggers a stale-data warning rather than silent use. |
| Cost center budget | ERP | Monthly batch sync | Actuals reconciled to the prior closed period; current-period actuals treated as provisional. |
| Upstream failure-prediction signal | Predictive Maintenance Assistant (equipment-level) | Event-driven / near-real-time | Signal must carry a stated confidence score; signals below a minimum confidence threshold are not used as a forecast covariate. |

## Stakeholders & Roles

| Role | Responsibility |
|---|---|
| Plant Maintenance Manager (Business Owner) | Owns the spares stocking policy and budget outcomes; approves pilot scope and KPI targets. |
| Maintenance Engineer | Reviews and approves Class A / criticality-flagged stocking and procurement recommendations; grants engineering sign-off on flagged alternative-part substitutions. |
| Maintenance Planner | Day-to-day triage of AI-flagged recommendations; primary approver for routine Class B/C stocking and procurement actions. |
| Plant Manager | Approves budget-flagged procurement actions exceeding the configured threshold; accountable for overall spares budget performance. |
| Procurement / Buyer | Owns final PO issuance and vendor relationship management; consulted on vendor ranking methodology and RFQ process. |
| Manufacturing AI Platform Lead (Technical Owner) | Owns plugin technical performance, model monitoring, connector health, and the model-retraining cadence. |
| Data/IT Governance | Owns connector credential management, data residency compliance, and audit-log retention. |

## Assumptions & Constraints

- SAP MM material master data includes, or can be enriched with, a criticality classification (Class A/B/C or equivalent) before pilot go-live; where absent, materials default to Class B pending manual review.
- At least 12 months of consumption history is available in SAP MM/Inventory Database for the pilot plant(s); materials with less history receive lower-confidence, clearly labeled forecasts.
- The Supplier Portal (or equivalent vendor-portal integration) is live and populated with current vendor catalog and OTIF performance data for the pilot's vendor population; where it is not yet integrated, vendor data is sourced from the SAP MM vendor master as an interim fallback with reduced alternative-part matching capability.
- The organization's LLM platform (see `Plugin/plugin.json` deployment configuration) is approved for processing the data classes involved (material descriptions, consumption quantities, vendor pricing) under existing data governance policy.
- Human approval tiers (Planner, Maintenance Engineer, Plant Manager) and their SAP MM release-strategy mapping already exist or are configured during the Environment Setup phase; this plugin does not redesign SAP's approval workflow, it drafts into it.

## Acceptance Criteria

| Acceptance Criterion | Mapped Requirement(s) |
|---|---|
| For a material with 12+ months of consumption history, the system produces a 3-month forecast with a stated model type and 80% prediction interval, reproducible from `Sample Data/consumption_history.csv`. | FR-1 |
| When an upstream failure-prediction signal is provided for a material's associated equipment, the forecast output explicitly states whether and how the signal was incorporated. | FR-2 |
| For every active material, a computed safety stock, reorder point, and min/max is generated with the applied criticality class and service-level target shown in the output. | FR-3 |
| A material with on-hand below its computed reorder point is flagged with a numeric days-of-cover value within one business day of the stock position dropping below threshold. | FR-4 |
| A material meeting the overstock criteria is flagged with an annualized carrying-cost dollar figure and the trailing-12-month consumption trend shown alongside. | FR-5 |
| For a material with 2+ qualified vendors in `vendor_catalog.csv`, the system returns a ranked shortlist with composite scores that shift appropriately when criticality class changes the weighting. | FR-6 |
| For a material with no vendor able to meet the required date, the system returns at least one embedding-matched alternative at or above 0.85 similarity, or explicitly states no confident match was found. | FR-7 |
| Any alternative-part match carrying a compatibility caveat in `alt_part_xref.csv` is labeled "requires engineering sign-off" and is never presented as auto-approvable. | FR-8 |
| Every stock-out-risk or overstock flag includes both a cost-of-action and cost-of-inaction dollar estimate and a budget-fit statement against the relevant cost center. | FR-9 |
| Every draft requisition/RFQ includes a justification string that cites specific record identifiers (work order refs, vendor IDs, or forecast figures) present in the source data, not a generic statement. | FR-10 |
| Every draft requisition/RFQ is tagged with the correct approval tier per the criticality/budget-fit rules, verified against a test matrix covering Class A/B/C and in-budget/over-threshold scenarios. | FR-11 |
| 100% of generated recommendations appear in the Inventory Database's `fact_ai_spare_recommendation` audit table within the batch cycle, including recommendations not acted upon. | FR-12 |
| A user-issued on-demand query (per the Prompt Library) returns a response within the NFR-1 latency target and without requiring a scheduled batch cycle to complete first. | FR-13 |
| No purchase requisition or RFQ is submitted to SAP MM/Supplier Portal without a logged human approval action preceding it, verified via audit log review during UAT. | NFR-3, FR-11 |
