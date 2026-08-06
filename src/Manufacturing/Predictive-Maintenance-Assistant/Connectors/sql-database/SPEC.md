# Connector: SQL Database (Analytics / Staging Layer)

*Adapted from the canonical specification at `Shared-Library/Connectors/SQL-Database.md`. Content below is consistent with that canonical spec; see this document's "Use in This Use Case" section for how the Predictive Maintenance Assistant specifically uses it.*

## Overview

A generic relational database connector (SQL Server, PostgreSQL, Snowflake, or Azure SQL) used as the analytics and staging layer that consolidates data extracted from SAP, MES, Historian, and OPC-UA sources into query-optimized tables for AI model inference, feature engineering, and reporting.

## Reusability Scope

Canonical connector used across nearly every department's AI use case (Maintenance, Quality, Production, Supply Chain) as the common analytical backbone. Schema below is illustrative for the Maintenance domain; the connection pattern is identical across departments.

## Authentication & Security

- **Protocol:** ODBC/JDBC or native driver (pyodbc, psycopg2, snowflake-connector) over TLS 1.2+.
- **Auth method:** Managed identity / service principal (Azure AD, IAM role) preferred; username/password with vaulted secrets (Azure Key Vault, HashiCorp Vault) as fallback.
- **Authorization:** Read-only service account (`svc_ai_readonly`) for inference workloads; a separate write-scoped account (`svc_ai_writer`) limited to designated staging/output schemas only. No direct write access to source-of-record tables.

## Core Data Objects (Maintenance Domain Example)

| Table | Description | Key Fields |
|---|---|---|
| `fact_sensor_readings` | Time-series sensor telemetry | equipment_id, timestamp, metric_name, value, unit |
| `fact_alarms` | Historized alarm events | equipment_id, alarm_code, severity, raised_at, cleared_at |
| `fact_maintenance_history` | Consolidated work order/notification history | equipment_id, order_no, order_type, downtime_hours, cost, closed_at |
| `dim_equipment` | Equipment master (synced from SAP PM) | equipment_id, description, criticality_class, install_date |
| `fact_failure_predictions` | Model output log | equipment_id, prediction_ts, failure_probability, predicted_component, model_version |

## Integration Pattern

- **Read:** Parameterized SQL queries (never string-concatenated) via connection pool; results streamed for large time-series pulls.
- **Write:** Inserts restricted to `fact_failure_predictions`, `fact_ai_recommendations`, and audit/log tables; all writes include `model_version`, `agent_id`, and `generated_at` for traceability.
- **Schema governance:** All schema changes go through a migration tool (Flyway/Liquibase); AI agents never issue DDL.

## Latency & Refresh

- Query response: < 1 second for indexed lookups; < 10 seconds for multi-table aggregations up to 5M rows.
- Refresh cadence: streaming CDC from OPC-UA/Historian (near real-time) and nightly batch from SAP.

## Error Handling

- Connection pool with circuit breaker; failed queries logged with query hash (not raw PII/sensitive values) for debugging.
- Query timeout capped at 30 seconds with graceful degradation to cached last-known-good result set.

## Sample Query

```sql
SELECT equipment_id, metric_name, value, timestamp
FROM fact_sensor_readings
WHERE equipment_id = @equipment_id
  AND timestamp >= DATEADD(day, -30, GETUTCDATE())
ORDER BY timestamp DESC;
```

## Use in This Use Case

The Predictive Maintenance Assistant uses this connector as its primary analytical read path and the sole write path for model outputs:

- **`fact_sensor_readings`** is queried continuously by the anomaly detection and RUL feature pipeline (fields exactly as sampled in `Sample Data/sensor_readings.csv`: `equipment_id`, `timestamp`, `metric_name`, `value`, `unit`, covering vibration, temperature, and current metrics).
- **`fact_alarms`** is queried by the Fault Diagnosis skill to correlate alarm timing with anomaly onset (fields as in `Sample Data/alarm_log.csv`: `equipment_id`, `alarm_code`, `severity`, `raised_at`, `cleared_at`).
- **`fact_maintenance_history`** is queried by the Root Cause Analysis and Maintenance Planner skills, and used to train/calibrate RUL and anomaly models (fields as in `Sample Data/maintenance_history.csv`: `equipment_id`, `order_no`, `order_type`, `downtime_hours`, `cost`, `closed_at`).
- **`dim_equipment`** supplies equipment criticality class and metadata used to scope every skill's retrieval and prioritization logic.
- **`fact_failure_predictions`** is the sole write target used by this use case's model layer, logging every anomaly score and RUL estimate with `model_version` for the audit trail required by NFR-6 in `Business Requirements.md`.
- The `svc_ai_readonly` account is used for all skill-time queries; the `svc_ai_writer` account is scoped exclusively to `fact_failure_predictions` and associated audit tables — no other writes are permitted.
