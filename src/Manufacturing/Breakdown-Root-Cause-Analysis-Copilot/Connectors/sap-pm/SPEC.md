# Connector Specification: SAP PM (Plant Maintenance)

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

The Breakdown Investigation Copilot uses SAP PM as both the **trigger source** and the **write-back destination** for the RCA workflow.

- **Trigger:** The Copilot subscribes to SAP PM's change-pointer/event feed for new Maintenance Notifications with `BreakdownIndicator = true` (e.g., notification `1000552341` on Equipment `10004521`, `MalfunctionStartDate = 2026-08-04T03:12:00Z`), which starts the investigation (FR-1).
- **Read for evidence:** The Incident Timeline Builder retrieves the triggering notification plus all prior notifications and orders for the same Functional Location (`PLANT-A-LINE3-PUMP01`) via `API_MAINTNOTIFICATION`/`API_MAINTENANCEORDER`, and the Equipment Master record (manufacturer, model, warranty status) via `API_EQUIPMENT`, to ground the timeline and the Corrective Action Generator's SOP-matching. Breakdown History (MTBF/MTTR) is pulled to contextualize whether this incident represents a repeat failure.
- **Write-back:** Only after an engineer's explicit Approve action in Teams, the Copilot writes the approved root cause and corrective action summary (see Prompt Library Prompt 10) back to the notification/work order as a completion note, using the same idempotent `X-Request-ID` pattern as the canonical spec's notification-create flow, scoped strictly to completion-note fields — the Copilot never changes Equipment Master data or closes a notification autonomously.
- **Fields consumed specifically:** `Equipment`, `FunctionalLocation`, `NotificationType`, `BreakdownIndicator`, `MalfunctionStartDate`, `ShortText`, `Priority`, plus historical `Order No.`, `Planned/Actual Dates`, and `Confirmations` for repeat-failure context.
