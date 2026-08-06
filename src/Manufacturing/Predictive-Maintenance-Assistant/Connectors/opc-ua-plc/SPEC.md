# Connector: OPC-UA / PLC

*Adapted from the canonical specification at `Shared-Library/Connectors/OPC-UA-PLC.md`. Content below is consistent with that canonical spec; see this document's "Use in This Use Case" section for how the Predictive Maintenance Assistant specifically uses it.*

## Overview

Direct connector to shop-floor PLCs and edge devices via the OPC-UA standard (or OPC-DA/Modbus through a protocol gateway), providing live and short-horizon historical access to machine telemetry: vibration, temperature, pressure, current draw, cycle counts, and digital alarm bits.

## Reusability Scope

Canonical connector for any manufacturing department needing shop-floor telemetry: Maintenance (Predictive Maintenance Assistant), Production (OEE/throughput monitoring), Quality (in-line process parameter capture), and EHS (environmental sensor monitoring).

## Authentication & Security

- **Protocol:** OPC-UA (IEC 62541) with Secure Channel (Basic256Sha256 security policy), or an OPC-UA gateway (Kepware/Ignition) bridging legacy Modbus/PLC protocols.
- **Auth method:** X.509 certificate-based mutual authentication between the AI edge gateway and the OPC-UA server; certificates rotated every 90 days via the plant PKI.
- **Authorization:** Read-only subscription access; the AI platform never writes setpoints or control values back to PLCs — this connector is monitoring-only by design to preserve OT safety boundaries.
- **Network segmentation:** Access brokered through an OT/IT DMZ; no direct AI-cloud-to-PLC connection — all traffic passes through an on-prem edge collector that forwards to the SQL/Historian staging layer.

## Core Data Objects

| Node Category | Example Tags | Update Rate |
|---|---|---|
| Vibration | `Line3.Pump01.Vibration.RMS_Velocity` | 1 Hz–100 Hz depending on sensor |
| Temperature | `Line3.Pump01.Bearing.Temp_C` | 1 sample / 10 sec |
| Pressure | `Line3.Compressor02.DischargePressure_bar` | 1 sample / 5 sec |
| Current Draw | `Line3.Motor04.Current_A` | 1 sample / 5 sec |
| Digital Alarms | `Line3.Pump01.Alarm.HighVibration` | Event-driven |
| Runtime Counters | `Line3.Pump01.RunHours_Total` | 1 sample / min |

## Integration Pattern

- **Read:** OPC-UA subscription (publish/subscribe) for real-time tags; batch history read (`HistoryRead` service) for backfill and training data.
- **Edge buffering:** Edge collector buffers up to 72 hours locally to survive network interruptions, then forwards to the SQL staging layer.
- **Data contextualization:** Raw tag names are mapped to SAP PM Equipment IDs via a tag-to-asset mapping table maintained jointly by OT and IT.

## Latency & Refresh

- Real-time streaming: sub-second to a few seconds depending on tag configuration. Historical backfill queries: seconds to minutes depending on range.

## Error Handling

- Subscription reconnect with backoff on OPC-UA server disconnects; gap-fill flagged in the staging table (`is_gap_filled = true`) so downstream models can discount imputed values.
- Out-of-range or sensor-fault values (stuck values, NaN) are flagged via a data-quality tag rather than silently forwarded to predictive models.

## Sample Subscription Config

```json
{
  "endpoint": "opc.tcp://edge-gateway-plant-a:4840",
  "securityPolicy": "Basic256Sha256",
  "nodes": [
    "ns=2;s=Line3.Pump01.Vibration.RMS_Velocity",
    "ns=2;s=Line3.Pump01.Bearing.Temp_C"
  ],
  "samplingIntervalMs": 1000,
  "queueSize": 10
}
```

## Use in This Use Case

The Predictive Maintenance Assistant treats this connector as its live sensory input, strictly read-only:

- Vibration RMS velocity, bearing/winding/oil temperature, discharge pressure, and motor current tags are subscribed per in-scope equipment (pumps, motors, compressors, conveyors, gearboxes), matching the metric types in `Sample Data/sensor_readings.csv` (`Vibration_RMS_Velocity`, `Bearing_Temp`, `Motor_Current`, `DischargePressure`, `OilTemp`, `Winding_Temp`).
- Digital alarm bits feed the alarm event stream that populates `fact_alarms` (matching `Sample Data/alarm_log.csv` fields), consumed by the Fault Diagnosis skill for alarm-anomaly correlation.
- Runtime counters feed the RUL model's operating-hours-since-last-overhaul feature.
- Consistent with the canonical spec's OT-safety boundary, this use case never requests, and the platform is not configured to permit, any write access to PLC setpoints or control logic — the assistant is monitoring-only.
- The tag-to-Equipment-ID mapping table (e.g., `Line3.Pump01` → SAP PM Equipment ID `10004521`) is a required onboarding artifact maintained jointly by OT and IT before an asset can be brought into scope (see `Implementation Guide.md`, Phase 2).
