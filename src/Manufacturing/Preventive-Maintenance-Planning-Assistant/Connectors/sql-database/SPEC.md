# Connector Specification: SQL Database (Analytics / Staging Layer)

*Adapted from the canonical spec at `Shared-Library/Connectors/SQL-Database.md`. Core specification reproduced below for reference; see "Use in This Use Case" for how the Preventive Maintenance Planning Assistant specifically consumes this connector.*

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

The SQL Database is the working analytics layer the Maintenance Scheduler and Resource Planner skills query directly — it holds the run-hour, technician-availability, and schedule-history tables (staged nightly from SAP PM, HR/roster systems, and Outlook Calendar) that drive the constraint model, and it is where the sample tables in this use case's `Sample Data/` folder (`equipment_runtime.csv`, `technician_availability.csv`, `pm_schedule_history.csv`) represent the loadable schema.

**Tables specifically used (extending the canonical Maintenance-domain schema):**
| Table | Use in This Use Case |
|---|---|
| `dim_equipment` | Extended with `run_hours_total`, `oem_service_interval_hours`, `last_service_date` (see `equipment_runtime.csv`) — the direct input to the Maintenance Scheduler's due-list computation. |
| `dim_technician_availability` (use-case-specific extension) | Staged from HR roster + Outlook Calendar free/busy sync; fields `technician_id`, `skill_cert`, `shift`, `available_dates`, `weekly_hours_capacity` (see `technician_availability.csv`) — consumed by the Resource Planner. |
| `fact_maintenance_history` | Extended for this use case with PM-specific fields `plan_id`, `planned_date`, `completed_date`, `status`, `variance_days` (see `pm_schedule_history.csv`) — the training/reference data for the scheduler's soft-constraint learning (e.g., which lines/days have historically high reschedule rates) and for the schedule-compliance KPI reporting in Business Process.md. |
| `fact_ai_recommendations` | Write target for every proposed schedule, resource assignment, and re-optimization diff generated by the assistant, tagged with `model_version` and `agent_id` per the canonical write pattern, supporting the audit requirements in NFR-4. |

**Access pattern:** all four skills (Maintenance Scheduler, Resource Planner, Checklist Generator, Calendar Optimizer) use the read-only `svc_ai_readonly` account for querying `dim_equipment`, `dim_technician_availability`, and `fact_maintenance_history`; only the Calendar Optimizer's audit-logging step uses the write-scoped `svc_ai_writer` account, and only against `fact_ai_recommendations` and the audit log table — no skill in this use case has or requires write access to source-of-record tables.
