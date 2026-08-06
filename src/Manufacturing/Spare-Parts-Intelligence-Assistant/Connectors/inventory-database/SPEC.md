# Connector Specification: Inventory Database

> Adapted from the canonical spec at `Shared-Library/Connectors/Inventory-Database.md`. Any change to authentication, authorization, or core data objects must be reconciled with the canonical version before being adopted here.

## Overview
A dedicated analytical inventory database (often a curated subset/mart derived from SAP MM plus WMS data) optimized for spare-parts analytics: consumption trends, stock-out frequency, carrying cost, and criticality scoring — workloads that are impractical to run directly against transactional SAP MM.

## Reusability Scope
Canonical connector reusable across Maintenance (Spare Parts Intelligence Assistant), Procurement (inventory optimization), and Supply Chain Planning.

## Authentication & Security
- **Protocol:** SQL/JDBC or REST API depending on the mart's hosting (Snowflake, Azure Synapse, or vendor WMS reporting API).
- **Auth method:** Managed identity/service principal with a read-only role for analytics workloads; a narrowly scoped write role for AI-generated recommendation logs only.
- **Authorization:** No write access to actual on-hand stock quantities — those remain owned by SAP MM/WMS as system of record; this connector is analytics/read plus recommendation-log write only.

## Core Data Objects
| Table | Description | Key Fields |
|---|---|---|
| `dim_spare_part` | Spare part master enriched with criticality | material_id, description, criticality_class, min_stock, max_stock, lead_time_days |
| `fact_consumption` | Historical usage | material_id, plant, consumed_qty, consumed_date, work_order_ref |
| `fact_stock_snapshot` | Daily stock position | material_id, plant, on_hand_qty, snapshot_date |
| `fact_ai_spare_recommendation` | AI-generated stocking/procurement recommendations | material_id, recommended_min, recommended_max, rationale, generated_at, model_version |

## Integration Pattern
- **Read:** Analytical SQL queries for demand forecasting (moving average, seasonal decomposition) and criticality scoring joins against `dim_spare_part`.
- **Write:** Recommendations written to `fact_ai_spare_recommendation`, which is separately reviewed and, on approval, actioned via the SAP MM connector (purchase requisition or stock-level change request).

## Latency & Refresh
- Daily batch refresh from SAP MM/WMS. Query response for analytical joins: typically < 5 seconds for a single material, < 30 seconds for a full-plant criticality re-scoring run.

## Error Handling
- Consumption records with implausible values (e.g., negative or order-of-magnitude outliers) are flagged `data_quality_flag = true` and excluded from forecasting until reviewed.

## Sample Query
```sql
SELECT material_id, AVG(consumed_qty) AS avg_monthly_consumption
FROM fact_consumption
WHERE plant = 'PLANT-A' AND consumed_date >= DATEADD(month, -12, GETUTCDATE())
GROUP BY material_id;
```

## Use in This Use Case

The Inventory Database is the primary analytical workhorse behind the Spare Parts Intelligence Assistant — every skill in this plugin reads from it before touching a transactional system:

- **`dim_spare_part`** is the direct analytical counterpart of `Sample Data/spare_part_master.csv` and supplies the criticality class and existing min/max parameters that the Inventory Analyzer and Cost Optimization skills use as their starting baseline before recommending a change.
- **`fact_consumption`** is the direct analytical counterpart of `Sample Data/consumption_history.csv`. The Spare Recommendation skill's forecasting models (moving average / exponential smoothing / regression, see `Technical Design.md`) query 12–24 months of `fact_consumption` per `material_id` and `plant` to produce the forward demand estimate.
- **`fact_stock_snapshot`** supplies the daily on-hand position used to compute days-of-cover and to detect stock-out risk ahead of a predicted consumption event; this is cross-checked against the live SAP MM stock read for any material flagged as at-risk, since the snapshot can be up to 24 hours stale.
- **`fact_ai_spare_recommendation`** is the write target for every output of the Spare Recommendation, Inventory Analyzer, and Cost Optimization skills — each recommended min/max, reorder point, or overstock flag is persisted here with a `model_version` and `rationale` string before any human approval or downstream SAP MM requisition is triggered, giving a complete, queryable audit trail of "what the AI recommended and why" independent of whether the recommendation was ultimately actioned.
- **Guardrail:** because this connector cannot write to actual on-hand stock, it can never itself change a physical inventory position — it can only recommend, log, and (via the SAP MM or Supplier Portal connectors) request. This separation is what keeps the analytics layer safe to iterate on quickly without risking transactional data integrity.
