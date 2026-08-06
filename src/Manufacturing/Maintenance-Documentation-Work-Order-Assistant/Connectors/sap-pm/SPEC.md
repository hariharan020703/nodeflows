# Connector Specification: SAP PM (Plant Maintenance)

## Overview
SAP PM is the system of record for maintenance master data and transactional maintenance activity: equipment master, functional locations, notifications, work orders, maintenance plans, task lists, and breakdown history. This connector provides bidirectional, read/write access so AI agents can retrieve maintenance context and write back notifications, work orders, and completion confirmations.

## Reusability Scope
Canonical, department-agnostic connector. Reused by: Maintenance (Predictive Maintenance Assistant, Breakdown RCA Copilot, Preventive Maintenance Planning Assistant, Maintenance Documentation & Work Order Assistant), and applicable to Quality (equipment-linked non-conformances), Production (asset availability), and EHS (safety-critical equipment tracking) in other manufacturing departments.

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

The Maintenance Documentation & Work Order Assistant uses SAP PM as both its primary grounding source and its primary write-back target:

- **Equipment Master / Functional Location (read):** The Work Order Generator skill queries `API_EQUIPMENT` to resolve a technician's spoken or written equipment reference (e.g., "Pump01 on line 3") to a canonical Equipment ID and Functional Location before drafting a notification, pre-populating fields the technician would otherwise re-type. Equipment IDs referenced in this use case's Sample Data (e.g., `10004521`, `10004541`, `20003312`) correspond to this object.
- **Maintenance Notification / Order (read):** Queried for open/recent records against the same equipment within a lookback window to support duplicate-submission detection (Business Requirements FR-15) before a new notification is drafted, and queried at shift-end for order status (Completed, Pending Parts, In Progress, Cancelled — as reflected in `Sample Data/work_order_completion.csv`) to feed the Shift Summary Generator skill.
- **Maintenance Notification / Order (write):** The Work Order Generator skill writes newly approved notifications/work orders, and the Report Writer skill writes completion confirmations (labor hours, parts consumed), following the OData POST/PATCH pattern with idempotency keys described above. Every write is gated by the human-approval step defined in Technical Design.md and carries the approver's identity in the resulting audit record.
- **Breakdown History (read):** Used sparingly by the Report Writer skill to check whether a described failure is part of a recurring pattern worth noting in a completion report's root-cause narrative, without duplicating the deeper diagnostic role of the Breakdown Root Cause Analysis Copilot use case.
