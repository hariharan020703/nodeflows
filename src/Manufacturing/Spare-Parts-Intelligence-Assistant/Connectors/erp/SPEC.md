# Connector Specification: ERP (Generic — SAP ERP / Oracle / Microsoft Dynamics)

> Adapted from the canonical spec at `Shared-Library/Connectors/ERP.md`. Any change to authentication, authorization, or core data objects must be reconciled with the canonical version before being adopted here.

## Overview
Generic connector to the enterprise ERP for production plan, cost center, and general master data that sits above plant-specific systems (SAP PM/MM) — e.g., production schedule commitments that constrain when preventive maintenance can be performed, and cost-center budget data for maintenance/spares spend analysis.

## Reusability Scope
Canonical connector reusable across Maintenance (Preventive Maintenance Planning, Spare Parts Intelligence), Production Planning, and Finance/Controlling reporting.

## Authentication & Security
- **Protocol:** ERP vendor API layer (SAP OData/BAPI, Oracle REST API for ERP Cloud, Dynamics 365 Web API) over OAuth 2.0/OIDC.
- **Auth method:** Service-principal/client-credentials flow with a dedicated integration user scoped to read access on production planning and cost-center objects.
- **Authorization:** Read-only for this use-case family; any write-back to ERP financial postings is explicitly out of scope and routed to human approval workflows.

## Core Data Objects
| Object | Description | Key Fields |
|---|---|---|
| Production Plan | Planned production runs by line/period | Line, Product, PlannedStart/End, PlannedQty |
| Cost Center | Maintenance/spares cost tracking | CostCenterID, Budget, ActualSpend, Period |
| Plant Calendar | Working days, shutdown windows, holidays | Plant, Date, DayType |
| Purchasing Info Record | Vendor/material pricing and lead times (cross-reference with SAP MM) | Material, Vendor, Price, LeadTimeDays |

## Integration Pattern
- **Read:** Scheduled batch pull (daily) of production plan and plant calendar into the SQL staging layer, used by scheduling/planning skills to avoid proposing maintenance windows during committed production runs.
- **Cost data:** Read cost-center actuals monthly for spend-optimization skills (e.g., Cost Optimization skill in Spare Parts Intelligence Assistant).

## Latency & Refresh
- Batch refresh: daily. On-demand lookups (e.g., "is Line 3 running this weekend?") answered from the most recent cached staging data with a visible as-of timestamp.

## Error Handling
- Stale-data guard: if the staging cache is older than 48 hours, planning skills surface a warning rather than silently planning against outdated production commitments.

## Sample Query (Staging Table)
```sql
SELECT line, planned_start, planned_end, planned_qty
FROM erp_production_plan
WHERE line = 'LINE3' AND planned_start BETWEEN '2026-08-10' AND '2026-08-17';
```

## Use in This Use Case

The ERP connector supplies two inputs the Spare Parts Intelligence Assistant needs but does not own: production context and financial context.

- **Production Plan:** The Spare Recommendation skill's demand forecast is not run in isolation from what the plant intends to produce — a planned production ramp-up on a line drives higher expected wear-part consumption than the trailing 12-month average alone would suggest. The forecasting layer reads `erp_production_plan` (Line, PlannedStart/End, PlannedQty) as a covariate/adjustment signal, particularly for consumables tied directly to run-hours (e.g., `SP-FILT-AIR-STD`, `SP-BELT-A-42`, `SP-LUBE-GREASE-EP2` in `Sample Data/consumption_history.csv`).
- **Cost Center:** The Cost Optimization skill reads monthly `Cost Center` actuals (Budget, ActualSpend by Period) for the maintenance/MRO cost center to frame every stocking recommendation in terms of budget headroom — e.g., flagging that a recommended max-stock increase on a Class A bearing would consume a specific percentage of the remaining quarterly spares budget, not just an inventory-value number in isolation.
- **Purchasing Info Record:** Used as a cross-check against the Supplier Portal and SAP MM vendor pricing/lead-time data — where the ERP-held purchasing info record and the live Supplier Portal quote diverge materially, the Vendor Recommendation skill surfaces both figures rather than silently preferring one source.
- **Guardrail:** this connector is strictly read-only in this use case. No spend, budget, or cost-center posting is ever written back through this connector; all financial commitments flow through the SAP MM purchase requisition/PO approval chain instead.
