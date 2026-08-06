# Connector Specification: Historian Database

## Overview
Connector to a process historian (AVEVA/Wonderware Historian, Honeywell PHD, GE Proficy, or InfluxDB-based equivalent) storing long-horizon, high-frequency time-series process data. Used to pull pre- and post-incident sensor trends for root cause analysis and to train/validate predictive models.

## Reusability Scope
Canonical connector reusable across Maintenance (Predictive Maintenance, Breakdown RCA), Production (process optimization), and Quality (process-parameter-to-defect correlation).

## Authentication & Security
- **Protocol:** Historian vendor SDK/REST API (e.g., AVEVA Historian REST, PI Web API) or SQL-based access for historian databases with a relational front-end.
- **Auth method:** Windows-integrated auth (Kerberos) for on-prem historians, or OAuth 2.0/API key for cloud-hosted historian services.
- **Authorization:** Read-only role scoped to designated tag groups per plant/line; no write access — the historian remains an immutable system of record for compliance and warranty purposes.

## Core Data Objects
| Object | Description |
|---|---|
| Tag Time-Series | Raw and compressed (swinging-door) sensor values per tag |
| Tag Metadata | Engineering units, tag description, asset linkage |
| Event Frames | Historian-native event/incident markers (e.g., PI Event Frames) bounding a start/end time for an incident |

## Integration Pattern
- **Read:** Time-windowed query (`RecordedValues` / `InterpolatedValues`) for a given tag list and time range; event-frame query to auto-discover incident boundaries.
- **Bulk export:** Scheduled export of relevant tag sets to the SQL staging layer for model training and RCA report generation, avoiding repeated direct historian load for read-heavy AI workloads.

## Latency & Refresh
- Live tag read: 1–5 seconds. Historical range query: seconds to a couple of minutes depending on range and tag count.

## Error Handling
- Compressed/interpolated data flagged distinctly from raw recorded data in query results so downstream RCA reasoning does not mistake interpolation artifacts for real transients.
- Historian downtime triggers fallback to the last successfully cached extract in the SQL staging layer, with a clear "data as of" timestamp shown to the user.

## Sample Query
```
GET /piwebapi/streams/{webId}/recorded?startTime=2026-08-03T20:00:00Z&endTime=2026-08-04T04:00:00Z
```

## Use in This Use Case

The Historian Database connector supplies the highest-resolution evidence in the RCA pipeline — the sensor trend that lets the Copilot show *when* a failure began to develop, not just when it finally tripped.

- **Read for evidence:** For the sample incident (Equipment `10004521`, malfunction start `2026-08-04T03:12:00Z`), the connector is queried for the tags mapped to this pump (`VIB-10004521` vibration velocity, `TEMP-10004521` bearing temperature, `FLOW-10004521` flow rate) across the ±8-hour window, returning the trend captured in `Sample Data/historian_sensor_trend.csv`: vibration rising from 2.1 to 12.4 mm/s, bearing temperature from 58.1°C to 95.4°C, and flow rate declining from 342 to 248 m3/h over the 7h10m preceding the trip.
- **Tag-to-equipment mapping:** A pre-built lookup table (established during Implementation Guide Phase 2 — Data Integration) resolves `equipment_id` to its tag list; without a current mapping, the Historian cannot be queried for that asset and the investigation proceeds with an explicit "Historian Unavailable" flag per NFR-7.
- **Similarity signature input:** The rate-of-change of vibration and temperature over the pre-trip window is extracted by the Failure Pattern Matcher as part of the numeric failure-signature vector used in the embedding-based similarity search against historical RCA reports.
- **Interpolation flagging:** Any value returned as interpolated rather than raw-recorded (e.g., during a brief historian compression gap) is labeled distinctly in the timeline so the RCA Analyzer does not treat a smoothed interpolation as a real instantaneous reading when assessing rate-of-change.
