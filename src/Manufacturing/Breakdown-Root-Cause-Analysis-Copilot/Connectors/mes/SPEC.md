# Connector Specification: MES (Manufacturing Execution System)

## Overview
Connector to the plant's MES (e.g., Siemens Opcenter, Rockwell FactoryTalk, AVEVA MES, or a custom MES) for production context: what was running, at what rate, under what operator/shift, and what quality events occurred at the time of an equipment incident. Critical for reconstructing incident timelines and correlating breakdowns with production conditions.

## Reusability Scope
Canonical connector reusable across Maintenance (Breakdown RCA Copilot), Production (OEE and schedule adherence), and Quality (linking defects to production runs).

## Authentication & Security
- **Protocol:** MES vendor REST/SOAP API, or B2MML/ISA-95 compliant message bus (e.g., MES-to-ERP integration bus) where available.
- **Auth method:** API key or OAuth 2.0 client credentials issued per integration, scoped to a read-only reporting role.
- **Authorization:** Read-only access to production order, downtime, and shift data; no write access — MES remains the sole system of record for shop-floor execution state.

## Core Data Objects
| Object | Description | Key Fields |
|---|---|---|
| Production Order Execution | Actual run data against a production order | OrderNo, Line, Product, StartTime, EndTime, ActualQty, ScrapQty |
| Downtime Event | MES-logged stoppage | Line, Equipment, ReasonCode, StartTime, EndTime, Duration |
| Shift/Operator Log | Who was operating what, when | ShiftID, OperatorID, Line, StartTime, EndTime |
| Quality Event | In-line quality flags/holds | OrderNo, DefectCode, QtyAffected, Timestamp |

## Integration Pattern
- **Read:** REST GET filtered by line/equipment and time window, used to reconstruct a timeline around a breakdown event (e.g., ±4 hours).
- **Correlation:** MES downtime reason codes are cross-referenced against SAP PM notification numbers via a shared `equipment_id` + timestamp join key.

## Latency & Refresh
- Near-real-time for downtime events (event-driven push where MES supports it); otherwise polling every 1–5 minutes.

## Error Handling
- Missing/late MES events (common during MES maintenance windows) are flagged as `data_gap = true` in the reconstructed timeline rather than assumed absent.

## Sample Query
```
GET /mes/api/v1/downtime-events?line=LINE3&from=2026-08-03T00:00:00Z&to=2026-08-04T00:00:00Z
```

## Use in This Use Case

The Breakdown Investigation Copilot's Incident Timeline Builder is the primary consumer of this connector, using it as the middle layer between SAP PM's transactional record and the Historian's raw sensor data.

- **Read for evidence:** For every triggered investigation, the connector is queried for all Downtime Events on the affected line and equipment across the configured window (default ±8 hours) — for example, `GET /mes/api/v1/downtime-events?line=LINE3&equipment=10004521&from=2026-08-03T19:12:00Z&to=2026-08-04T11:12:00Z`, which returns the precursor `RATE_REDUCTION` and `DEGRADED_FLOW` events plus the `BEARING_FAILURE` stoppage itself (see `Sample Data/mes_downtime_events.csv`).
- **Correlation key:** `equipment_id` + `start_time`/`end_time` are joined against SAP PM's `MalfunctionStartDate` and Historian tag timestamps by the Incident Timeline Builder (±2-minute tolerance) to produce the unified timeline described in Technical Design.
- **Additional context fields used:** `ReasonCode` (used directly as a structured input to the Failure Pattern Matcher's failure-signature embedding), `Line`, and Shift/Operator Log entries (surfaced to the engineer as "who was on shift" context, though not used as causal evidence on their own).
- **Data-gap handling:** If the MES has no downtime event recorded for a sub-interval where Historian data shows an anomaly (or vice versa), the Copilot flags `data_gap = true` for that interval per FR-3/NFR-7, and the RCA Analyzer caps confidence at Medium for any hypothesis relying solely on the gapped interval.
