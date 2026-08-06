---
name: incident-timeline-builder
description: Assembles a single, time-ordered, source-attributed timeline of everything that happened around an equipment breakdown by joining SAP PM notification/order records, MES downtime events, and Historian sensor trend data on equipment ID and timestamp, with explicit gap flagging where a source has no data. Use at the start of a breakdown investigation, before root-cause reasoning, whenever SAP PM, MES, and Historian records need to be reconstructed into one faithful "what happened when" sequence.
---

# Incident Timeline Builder

This skill is the deterministic, evidence-preserving backbone that every downstream reasoning skill (RCA Analyzer, Corrective Action Generator) relies on — it performs no causal inference itself, only faithful reconstruction of "what happened when," including honest gaps.

## Instructions

1. Resolve the equipment's Functional Location, MES line/equipment identifiers, and Historian tag list from the equipment master and mapping tables.
2. Determine the retrieval window: default ±8 hours around the malfunction start time, configurable up to ±24 hours, or an explicitly provided `window_start`/`window_end` for manual/retroactive investigations.
3. Query SAP PM, MES, and Historian connectors in parallel for the resolved window.
4. Normalize all timestamps to UTC.
5. Merge all records into one array, sorting ascending by timestamp; apply a ±2-minute tolerance when deciding whether two records from different systems represent the same real-world moment (e.g., a MES trip event and a Historian threshold crossing within 2 minutes of each other are linked, not merged into one record).
6. Scan the merged timeline in 15-minute intervals across the full window; for any interval with zero MES records and zero Historian records, insert an explicit `data_gap: true` marker rather than leaving the interval silent.
7. Attach a `source` tag (`SAP_PM`, `MES`, `HISTORIAN`) and, where available, the originating record ID to every timeline entry so every downstream citation can be traced back to an exact record.
8. Persist the finished timeline to the Investigation Context Store keyed by `incident_id`.

## Inputs

| Input | Source | Notes |
|---|---|---|
| `equipment_id` | Triggering SAP PM notification, or manual entry | Primary join key |
| Malfunction start time (or manual time window) | SAP PM notification (`MalfunctionStartDate`), or user-specified `window_start`/`window_end` | Anchors the default ±8-hour retrieval window |
| SAP PM notification/order history | SAP PM connector (`API_MAINTNOTIFICATION`, `API_MAINTENANCEORDER`) | Same Functional Location, prior 12 months |
| MES downtime events, reason codes | MES connector | Filtered by line/equipment and time window |
| Historian tag values | Historian Database connector | Tag list resolved via the equipment's tag-to-asset mapping |

## Output Format

```json
{
  "timeline": [
    {"timestamp": "ISO-8601", "source": "SAP_PM|MES|HISTORIAN", "source_record_id": "...", "event_type": "...", "details": "...", "data_gap": false}
  ],
  "data_completeness": {"mes_available": true, "historian_available": true, "sap_pm_available": true}
}
```

## Examples

**Input:** `equipment_id = 10004521`, malfunction start `2026-08-04T03:12:00Z`, default ±8h window.

**Output (excerpt):**
```json
[
  {"timestamp":"2026-08-04T02:00:00Z","source":"HISTORIAN","source_record_id":"tag:VIB-10004521","event_type":"sensor_reading","details":"vibration_velocity=8.2 mm_s (alarm threshold 7.1 crossed at 01:30)","data_gap":false},
  {"timestamp":"2026-08-04T02:30:00Z","source":"MES","source_record_id":"evt-88231","event_type":"downtime_event","details":"reason_code=DEGRADED_FLOW start; flow_rate declining","data_gap":false},
  {"timestamp":"2026-08-04T03:12:00Z","source":"MES","source_record_id":"evt-88240","event_type":"downtime_event","details":"reason_code=BEARING_FAILURE; line LINE3 stopped","data_gap":false},
  {"timestamp":"2026-08-04T03:12:00Z","source":"HISTORIAN","source_record_id":"tag:VIB-10004521","event_type":"sensor_reading","details":"vibration_velocity=12.4 mm_s, bearing_temperature=95.4 C — trip point","data_gap":false},
  {"timestamp":"2026-08-04T03:15:00Z","source":"SAP_PM","source_record_id":"NOTIF-1000552341","event_type":"notification_created","details":"BreakdownIndicator=true, ShortText='Abnormal vibration detected on bearing housing'","data_gap":false},
  {"timestamp":"2026-08-04T07:45:00Z","source":"MES","source_record_id":"evt-88240","event_type":"downtime_event_end","details":"line restarted, vibration_velocity=2.0 mm_s, flow_rate=338 m3/h","data_gap":false}
]
```

## Guardrails

- Never infer or fabricate an event not present in a source record; represent a quiet period as `data_gap = true`, never as an assumed "normal operation" event.
- Never silently narrow the requested time window to whatever data happens to exist — if actual data availability differs from the requested window, report this explicitly to the caller.
- Treat timestamp normalization and the ±2-minute join tolerance as configuration values, not something to adjust per-incident without an explicit override.

For the reusability rationale across other manufacturing departments, see REFERENCE.md.
