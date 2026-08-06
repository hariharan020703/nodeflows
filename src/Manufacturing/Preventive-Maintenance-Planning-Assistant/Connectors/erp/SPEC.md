# Connector Specification: ERP (Generic — SAP ERP / Oracle / Microsoft Dynamics)

*Adapted from the canonical spec at `Shared-Library/Connectors/ERP.md`. Core specification reproduced below for reference; see "Use in This Use Case" for how the Preventive Maintenance Planning Assistant specifically consumes this connector.*

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

The Preventive Maintenance Planning Assistant treats the ERP Production Plan and Plant Calendar as the **primary hard-constraint source** for the Maintenance Scheduler skill's constraint model: no PM task may be scheduled during a `Production Plan` window that commits the asset's line to production, and no PM task may be scheduled on a `Plant Calendar` day marked as a plant shutdown (those days are instead prioritized as ideal PM windows, since the line is already down).

**Objects specifically consumed:**
- **Production Plan** (`Line`, `PlannedStart`, `PlannedEnd`, `PlannedQty`): read daily into the SQL staging layer's `erp_production_plan` table and joined against `equipment_runtime.csv`'s `line` field to determine feasible scheduling windows per asset. `PlannedQty` also feeds the Maintenance Scheduler's runtime-velocity projection (Step 2 of the Maintenance Scheduler skill) — higher planned throughput accelerates the rate at which an asset accrues run-hours toward its OEM interval.
- **Plant Calendar** (`Plant`, `Date`, `DayType`): shutdown/holiday days are surfaced to the Calendar Optimizer as preferred high-availability PM windows, since technician access to the asset is unconstrained by production.
- **Cost Center** data is not consumed by this use case (out of scope — see Business Requirements Out-of-Scope) but the connector's read access is provisioned identically to other Maintenance use cases for consistency of the service account footprint.

**Staleness handling:** Because a stale production plan could cause the scheduler to propose a PM task during what is actually a live, uncached production run, the Maintenance Scheduler enforces the connector's 48-hour staleness guard strictly — if the cached `erp_production_plan` data is older than 48 hours, the scheduler blocks automatic publication and requires a Planner to confirm the current production plan before any schedule is written to Outlook Calendar or SAP PM.
