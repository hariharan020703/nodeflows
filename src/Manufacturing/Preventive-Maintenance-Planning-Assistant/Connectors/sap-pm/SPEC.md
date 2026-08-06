# Connector Specification: SAP PM (Plant Maintenance)

*Adapted from the canonical spec at `Shared-Library/Connectors/SAP-PM.md`. Core specification reproduced below for reference; see "Use in This Use Case" for how the Preventive Maintenance Planning Assistant specifically consumes this connector.*

## Overview
SAP PM is the system of record for maintenance master data and transactional maintenance activity: equipment master, functional locations, notifications, work orders, maintenance plans, task lists, and breakdown history. This connector provides bidirectional, read/write access so AI agents can retrieve maintenance context and write back notifications, work orders, and completion confirmations.

## Reusability Scope
Canonical, department-agnostic connector. Reused by: Maintenance (Predictive Maintenance Assistant, Breakdown RCA Copilot, Preventive Maintenance Planning Assistant), and applicable to Quality (equipment-linked non-conformances), Production (asset availability), and EHS (safety-critical equipment tracking) in other manufacturing departments.

## Authentication & Security
- **Protocol:** SAP OData services (API_MAINTNOTIFICATION, API_MAINTENANCEORDER, API_EQUIPMENT) over SAP Gateway, or SAP PI/PO middleware for legacy ECC landscapes.
- **Auth method:** OAuth 2.0 client-credentials flow against SAP Cloud Identity Services, with fallback to SAP Basic Auth + communication user for on-prem Gateway.
- **Authorization:** Role-based SAP authorization objects (I_QMEL, I_AFVGD) scoped to a dedicated service communication user (`SVC_AI_MAINT`) with read access to all plants and restricted write access limited to notification/work-order creation transaction codes (IW21, IW31 equivalents via API).
- **Data residency:** All calls routed through the customer's SAP Gateway; no maintenance data is persisted outside the enterprise boundary except in short-lived, encrypted agent working memory.

## Core Data Objects
| Object | SAP Transaction Equivalent | Key Fields |
|---|---|---|
| Equipment Master | IE03 | Equipment ID, Description, Functional Location, Object Type, Manufacturer, Serial No., Warranty Dates |
| Functional Location | IL03 | FL Code, Hierarchy Level, Plant, Cost Center |
| Maintenance Notification | IW21/IW23 | Notification No., Type (M1/M2/M3), Equipment, Breakdown Flag, Malfunction Start/End, Damage Code |
| Maintenance Order | IW31/IW33 | Order No., Order Type (PM01/PM02/PM03), Priority, Planned/Actual Dates, Operations, Confirmations |
| Maintenance Plan | IP10 | Plan No., Cycle, Task List, Next Due Date |
| Breakdown History | PM Info System | Equipment, MTBF, MTTR, Downtime Hours, Cost |

## Integration Pattern
- **Read:** Near-real-time OData GET with OData $filter for equipment/date-range queries; batch nightly extract to staging SQL for analytics workloads.
- **Write:** Synchronous OData POST/PATCH for notification and work-order creation, wrapped in an idempotency key (`X-Request-ID`) to prevent duplicate order creation on retry.
- **Change data capture:** SAP Change Pointers or event mesh (SAP Event Mesh / CDC on HANA) to push equipment status and order status changes to the agent's event queue.

## Latency & Refresh
- Transactional reads: < 2 seconds (OData). Batch/analytical extracts: hourly or nightly, configurable. Write-backs: synchronous, confirmed within 5 seconds.

## Error Handling
- Retries: 3 attempts with exponential backoff on 5xx/timeout.
- On authorization failure (403), escalate to a human-in-the-loop queue rather than silently dropping the transaction.
- All write-backs generate an audit record (who/what agent, timestamp, payload hash) stored in the Historian/SQL audit table.

## Sample Payload (Notification Create)
```json
{
  "NotificationType": "M2",
  "Equipment": "10004521",
  "FunctionalLocation": "PLANT-A-LINE3-PUMP01",
  "ShortText": "Abnormal vibration detected on bearing housing",
  "MalfunctionStartDate": "2026-08-04T03:12:00Z",
  "BreakdownIndicator": true,
  "Priority": "1",
  "ReportedBy": "AI_PREDICTIVE_MAINT_AGENT"
}
```

## Use in This Use Case

The Preventive Maintenance Planning Assistant reads from SAP PM as the authoritative source of equipment master data (`IE03`), Maintenance Plan cycle/interval data (`IP10`), and closed work-order confirmations that feed schedule-compliance history. It writes back scheduled PM work orders (`IW31` equivalent) and, on completion, work-order confirmations with actual duration and findings.

**Objects specifically consumed:**
- **Equipment Master (IE03):** `Equipment ID`, `Description`, `Manufacturer`, `Functional Location`, `Object Type` — used by the Maintenance Scheduler skill to build the due-list candidate set and by the Checklist Generator skill to resolve the correct OEM manual.
- **Maintenance Plan (IP10):** `Cycle`, `Task List`, `Next Due Date` — cross-referenced against the SQL Database's `run_hours_total` to compute `interval_utilization` (see `equipment_runtime.csv` schema).
- **Maintenance Order (IW31/IW33):** the Calendar Optimizer skill creates a Maintenance Order with `Order Type = PM01` for each confirmed schedule slot, and later posts the completion confirmation (actual date, actual hours, technician) back to the same order — this is the transaction that ultimately populates `pm_schedule_history.csv`-equivalent production tables.
- **Breakdown History (PM Info System):** consumed read-only by the Maintenance Scheduler's soft-constraint weighting to avoid scheduling routine PM immediately adjacent to an asset's recent breakdown window (to avoid compounding technician workload on the same asset).

**Write actions requiring approval:** Maintenance Order creation is auto-generated by the assistant but held in "Planned, Unreleased" status until a Maintenance Planner releases it in SAP PM or approves the release via the Teams adaptive card workflow — the assistant does not release orders directly to the shop floor without this gate (see Business Requirements NFR-5 and Plugin manifest `human_approval_required_for`).
