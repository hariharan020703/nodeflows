# Spare Parts Intelligence Assistant

**Turning spare-parts inventory from a guessing game into a forecasted, criticality-weighted, self-justifying procurement pipeline.**

## Business Problem

Maintenance organizations routinely lose repair time not because a technician lacks skill, but because the right part is not on the shelf, or too much capital is tied up in the wrong parts. Spare-parts inventory management in most plants is still driven by static min/max levels set years ago, tribal knowledge about "what usually breaks," and reactive emergency ordering once a stock-out is discovered mid-repair.

The cost pattern is well documented industry-wide (illustrative benchmarks, not client-specific figures):

- MRO inventory in a typical discrete-manufacturing plant runs **20-30% overstocked by value** while simultaneously experiencing **stock-outs on 5-15% of critical-part requests** — the two problems coexist because stocking levels are rarely criticality-weighted or demand-forecast-driven (industry MRO benchmarking studies, e.g., APICS/ASCM and Aberdeen Group inventory research).
- A stock-out on a critical spare during an active repair typically extends mean-time-to-repair (MTTR) by **2-5x** versus a repair where the part was on hand, since the equipment remains down while emergency sourcing (expedited freight, alternate vendor sourcing) is arranged.
- Emergency/expedited spare-part procurement typically carries a **30-60% price premium** over planned procurement, driven by expedite fees, air freight, and reduced vendor negotiating leverage under time pressure.
- Carrying cost on excess/obsolete MRO inventory (capital cost, storage, insurance, obsolescence risk) is typically estimated at **20-25% of inventory value per year** — capital that could otherwise fund criticality-appropriate stocking of genuinely at-risk parts.

These are directional, industry-typical ranges intended to frame the scale of the opportunity — actual figures should be validated against plant-specific inventory valuation, stock-out logs, and MTTR data during the Discovery phase (see `Implementation Guide.md`).

## AI Goal

Predict spare-part consumption at the material/plant level using historical usage and, where available, upstream equipment failure-prediction signals; recommend criticality-weighted inventory levels (safety stock, reorder point, min/max) that balance stock-out risk against carrying cost; identify functionally equivalent alternative parts when the primary material is out of stock or unavailable within the required lead time; and automatically draft procurement requests — purchase requisitions and vendor RFQs — for human approval when a stocking or sourcing action is warranted.

## Solution Overview

The Spare Parts Intelligence Assistant is an AI copilot that sits between the plant's transactional system of record for materials and purchasing (SAP MM), an analytical inventory data mart optimized for consumption and criticality analysis (Inventory Database), the broader enterprise planning context (ERP — production plans and cost centers), and the external sourcing ecosystem (Supplier Portal — vendor catalogs, alternative-part cross-references, and RFQ submission). It continuously ingests consumption history and current stock positions, forecasts forward demand per material and plant using a tiered time-series/ML approach suited to each part's volume and criticality profile, and hands the resulting demand signal to a criticality-weighted inventory-optimization layer that computes safety stock, reorder points, and min/max bands grounded in classical inventory science rather than static, stale defaults.

When a material crosses into stock-out risk or overstock territory, the assistant does not stop at a number — it reasons about the sourcing options (Vendor Recommendation skill, including embedding-based alternative-part matching when the primary material is unavailable), quantifies the financial trade-off between the cost of action and the cost of inaction (Cost Optimization skill, expressed in dollars against the relevant cost-center budget), and drafts the resulting purchase requisition or RFQ text that a buyer or planner would otherwise write by hand. Every recommendation carries an LLM-generated, source-grounded explanation — never a bare number — citing the specific consumption records, criticality class, and vendor data that produced it.

Every output that changes a system of record — submitting a purchase requisition, issuing an RFQ, adjusting a stocking policy — passes through a criticality-appropriate human-in-the-loop approval gate (planner, maintenance engineer, or plant manager depending on materiality and criticality class), so the assistant accelerates and de-risks procurement decisions without removing accountable humans from spend and safety-relevant actions.

## Key Capabilities

- Tiered demand forecasting (moving average, Holt-Winters exponential smoothing, or gradient-boosted regression with failure-prediction covariates) selected automatically by data volume and criticality class.
- Criticality-weighted safety stock, reorder point, and min/max computation grounded in service-level targets differentiated by Class A/B/C criticality.
- Automatic stock-out risk detection with days-of-cover quantification and overstock/slow-mover detection with annualized carrying-cost quantification.
- Embedding-based alternative-part matching against internal and vendor catalog cross-references, with an explicit compatibility-validation gate that routes engineering-sensitive substitutions to human review.
- Multi-vendor ranking on a price/lead-time/OTIF composite score, weighted by material criticality.
- Dollar-denominated cost-of-action vs. cost-of-inaction framing for every stocking and procurement recommendation, checked against cost-center budget headroom.
- Auto-drafted purchase requisitions and vendor RFQs with LLM-generated, source-cited justification text, routed to the correct human approval tier before write-back.
- Full audit trail of every AI-generated recommendation, whether or not it was ultimately actioned.

Skills and Connectors below now follow Claude's real Agent Skills and MCP formats — each Skill is a `Skills/<skill-name>/SKILL.md` folder and each Connector is a live MCP server declared under `Connectors/<connector-name>/`, rather than the flat narrative files used previously.

## Skills Used

| Skill | Path | Purpose |
|---|---|---|
| Spare Recommendation | `Skills/spare-recommendation/SKILL.md` | Forecasts forward spare-part consumption per material/plant using a tiered time-series/ML approach and recommends stocking-parameter changes. |
| Inventory Analyzer | `Skills/inventory-analyzer/SKILL.md` | Computes criticality-weighted safety stock, reorder points, and min/max bands; flags stock-out risk and overstock/slow-movers with quantified carrying cost. |
| Vendor Recommendation | `Skills/vendor-recommendation/SKILL.md` | Ranks qualified vendors on price/lead-time/OTIF and identifies embedding-matched alternative parts when the primary material is unavailable. |
| Cost Optimization | `Skills/cost-optimization/SKILL.md` | Quantifies the cost-of-action vs. cost-of-inaction trade-off, checks budget fit, and drafts the procurement requisition/RFQ for human approval. |

## Connectors Used

| Connector | Path | Purpose |
|---|---|---|
| SAP MM | `Connectors/sap-mm/` | System of record for material master, criticality class, live stock position, and purchase requisition write-back. |
| Inventory Database | `Connectors/inventory-database/` | Analytical mart for consumption history, stock snapshots, and the logged AI recommendation audit trail. |
| ERP | `Connectors/erp/` | Production plan (demand-adjustment covariate) and cost-center budget data for spend-optimization framing. |
| Supplier Portal | `Connectors/supplier-portal/` | Live vendor catalog pricing/lead time/OTIF, alternative-part cross-references, and RFQ submission. |

## Plugin Name

**Spare Parts Copilot** (`name: spare-parts-copilot`, manifest at `Plugin/.claude-plugin/plugin.json`)

## Folder Contents Index

| Location | Contents |
|---|---|
| `README.md` | This document — use case overview, capabilities, skills, connectors. |
| `Business Process.md` | Current-state vs. future-state spare-parts process, Mermaid process flow, RACI, KPIs. |
| `Business Requirements.md` | Objective, scope, numbered functional/non-functional requirements, data requirements, acceptance criteria. |
| `Technical Design.md` | Architecture, Mermaid diagram, AI/model approach (forecasting + inventory optimization + embedding matching + LLM), skill design, security/governance. |
| `Implementation Guide.md` | Prerequisites, phased rollout plan, environment setup, testing strategy, change management, go-live checklist. |
| `Prompt Library.md` | Production-ready prompts used by the skills and as user-facing quick actions, with governance notes. |
| `Sample Data/` | `spare_part_master.csv`, `consumption_history.csv`, `vendor_catalog.csv`, `alt_part_xref.csv` — realistic, internally consistent test data. |
| `Skills/` | One Agent Skill folder per skill (`spare-recommendation/`, `inventory-analyzer/`, `vendor-recommendation/`, `cost-optimization/`), each with `SKILL.md` and `REFERENCE.md`. |
| `Connectors/` | One MCP connector folder per connector (`sap-mm/`, `inventory-database/`, `erp/`, `supplier-portal/`), each with `SPEC.md` (narrative), `mcp-server.json` (client declaration), and `tools.json` (MCP tool manifest). |
| `Plugin/` | `.claude-plugin/plugin.json` (manifest), `.mcp.json` (aggregated MCP server declarations), and `PLUGIN_GUIDE.md` (installation, configuration, validation, rollback, reusability). |

## Ownership / Maintainer

| Role | Responsibility |
|---|---|
| Business Owner | Plant Maintenance Manager (spares budget and stocking policy owner) |
| Technical Owner | Manufacturing AI Platform Lead |
