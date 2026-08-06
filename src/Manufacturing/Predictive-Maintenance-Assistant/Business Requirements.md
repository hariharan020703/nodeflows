# Business Requirements — Predictive Maintenance Assistant

## Objective

Deploy an AI-based Predictive Maintenance Assistant that continuously analyzes machine health signals — sensor telemetry, alarms, runtime data, and historical maintenance records — for in-scope critical and semi-critical rotating and mechanical equipment (pumps, motors, gearboxes, bearings, conveyors, compressors) in order to detect degradation early, predict failures with a stated confidence and lead time, and orchestrate diagnosis, planning, and reporting workflows that convert reactive breakdown maintenance into planned, resource-efficient maintenance — while keeping accountable humans in control of every system-of-record write-back and safety-relevant decision.

## In-Scope

- Continuous ingestion and analysis of OPC-UA/PLC telemetry (vibration, temperature, current draw, pressure, digital alarms, runtime counters) and SQL-staged historical sensor/alarm/maintenance data for equipment designated as Criticality Class A or B in SAP PM equipment master.
- Statistical and machine-learning-based anomaly detection and remaining-useful-life (RUL) estimation for rotating assets (pumps, motors, gearboxes, fans, compressors) and bearing-dependent mechanical assets (conveyors).
- LLM-orchestrated Fault Diagnosis, Root Cause Analysis, Maintenance Planning, SOP Retrieval, and Maintenance Report Writer skills as defined in `Skills/`.
- Read/write integration with SAP PM (notifications, work orders, breakdown history), read access to SQL analytics/staging layer, read access to OPC-UA/PLC telemetry, read/write access to SharePoint (SOPs, RCA archive), and outbound messaging via Microsoft Teams and Outlook.
- Human-in-the-loop approval workflow for all SAP PM write-backs and all outbound escalations to Plant Manager level.
- Delivery of risk briefings, diagnostic summaries, and closing reports to Technicians, Maintenance Engineers, Planners, and Plant Managers.

## Out-of-Scope

- Direct control actions on PLCs or equipment setpoints (the OPC-UA connector is monitoring-only by design; see `Connectors/opc-ua-plc/SPEC.md`).
- Automated (non-human-approved) creation or closure of SAP PM work orders.
- Spare parts inventory optimization and procurement automation (addressed by the separate Spare Parts Intelligence Assistant use case).
- Preventive maintenance calendar/task-list design from scratch (addressed by the separate Preventive Maintenance Planning Assistant use case); this assistant consumes and respects the existing PM calendar but does not redesign it.
- Equipment outside Criticality Class A/B (e.g., non-critical utility equipment) unless explicitly onboarded in a later phase.
- Financial ROI attribution/accounting beyond operational KPI tracking.

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | The system shall ingest live and historical telemetry (vibration, temperature, current, pressure, runtime counters, digital alarms) for all in-scope equipment via the OPC-UA/PLC connector and the SQL Database staging layer. |
| FR-2 | The system shall compute statistical control-limit and isolation-forest-based anomaly scores per equipment/metric combination, refreshed at least every 15 minutes for streaming tags. |
| FR-3 | The system shall produce a remaining-useful-life (RUL) estimate with an associated confidence interval for each in-scope rotating asset, updated at least daily or on new anomaly detection, whichever is more frequent. |
| FR-4 | When an anomaly score or RUL estimate crosses a configured risk threshold, the system shall automatically invoke the Fault Diagnosis skill to produce a ranked list of probable failure modes with confidence scores. |
| FR-5 | The system shall invoke the Root Cause Analysis skill to generate a root-cause hypothesis grounded in retrieved historical RCA reports and OEM documentation from SharePoint, with citations to the retrieved source documents. |
| FR-6 | The system shall invoke the SOP Retrieval skill to surface the specific SOP or checklist section relevant to the diagnosed fault, not merely a document-level link. |
| FR-7 | The system shall invoke the Maintenance Planner skill to propose a recommended maintenance action window, resourcing, and a parts-availability check against SAP PM and existing PM schedules. |
| FR-8 | The system shall deliver a structured risk briefing (equipment ID, predicted failure window, confidence, root-cause hypothesis, SOP reference, recommended plan) via a Microsoft Teams adaptive card to the designated maintenance channel within 5 minutes of threshold breach. |
| FR-9 | The system shall allow a Maintenance Engineer to confirm, edit, or reject the AI-generated diagnosis via the Teams adaptive card or a linked review interface, and shall log the human decision. |
| FR-10 | The system shall invoke the Maintenance Report Writer skill to draft SAP PM notification and work order text, and shall not submit this write-back to SAP PM without explicit human approval. |
| FR-11 | The system shall draft a closing maintenance report (downtime hours, cost, root cause, resolution) from technician input and structured order data, and shall route it for human confirmation before SAP PM closure. |
| FR-12 | The system shall archive the finalized diagnostic trail (anomaly evidence, diagnosis, root cause, resolution) to the SharePoint RCA library in a structured, searchable format for future retrieval. |
| FR-13 | The system shall generate and deliver a weekly risk-and-performance summary (open risk items, avoided-downtime estimate, KPI trend) to the Plant Manager via Outlook and/or Teams. |
| FR-14 | The system shall provide fallback delivery via Outlook email if a Teams message delivery fails after 3 retries. |
| FR-15 | The system shall flag and separately tag any telemetry gaps or sensor-fault values (stuck values, out-of-range, NaN) rather than silently including them in model inference. |
| FR-16 | The system shall log every model prediction (failure probability, predicted component, model version) to the `fact_failure_predictions` table for traceability and future model evaluation. |

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Anomaly detection scoring on streaming tags shall complete within 60 seconds of data arrival at the SQL staging layer under normal load. |
| NFR-2 | End-to-end latency from risk-threshold breach to risk-briefing delivery in Teams shall not exceed 5 minutes (95th percentile). |
| NFR-3 | The platform shall achieve at least 99.5% availability for the inference and orchestration layer, measured monthly. |
| NFR-4 | All connector authentication shall use OAuth 2.0 / certificate-based mutual authentication as specified in each connector's canonical spec; no plaintext credentials shall be stored in application code or configuration files. |
| NFR-5 | All data shall remain within the customer's designated data residency boundary (on-prem SAP Gateway / regional Azure tenant); no sensor, maintenance, or personal data shall be persisted in a third-party model provider's training data. |
| NFR-6 | Every AI-generated recommendation and every human approval/rejection decision shall be logged with timestamp, agent/model version, and user identity for audit purposes, retained for a minimum of 3 years or per plant records-retention policy, whichever is longer. |
| NFR-7 | Every AI-generated diagnostic or root-cause claim delivered to a human shall include a citation to the underlying sensor evidence, historical record, or retrieved document — outputs without traceable grounding shall be flagged as low-confidence rather than presented as fact. |
| NFR-8 | The system shall support at least 500 concurrently monitored equipment tags per plant without degradation of NFR-1/NFR-2 targets. |
| NFR-9 | All SAP PM write-back actions shall be reversible or correctable through standard SAP PM transactions (no destructive, irreversible writes performed autonomously). |
| NFR-10 | The system shall degrade gracefully on connector failure: on OPC-UA/SQL outage, it shall serve last-known-good cached data with an explicit staleness indicator rather than failing silently or fabricating values. |

## Data Requirements

| Data Domain | Source | Frequency | Quality Requirement |
|---|---|---|---|
| Vibration, temperature, current, pressure telemetry | OPC-UA/PLC connector | Streaming (1 Hz–1/min depending on tag) | Gap-filled samples flagged (`is_gap_filled=true`); out-of-range/stuck values flagged via data-quality tag, not forwarded silently to models. |
| Digital alarm events | OPC-UA/PLC connector | Event-driven | Alarm code, severity, raised/cleared timestamps required for every event. |
| Historized sensor/alarm data | SQL Database (`fact_sensor_readings`, `fact_alarms`) | Near real-time CDC + nightly batch reconciliation | Consistent equipment_id keys joined to `dim_equipment`. |
| Equipment master and criticality classification | SAP PM (synced to `dim_equipment`) | Nightly batch / on change | Criticality class must be populated for all in-scope equipment before onboarding. |
| Maintenance notifications, work orders, breakdown history | SAP PM | Near real-time (write), nightly batch (analytical read) | Order type, downtime hours, and cost fields must be populated at closure for KPI calculation. |
| SOPs, OEM manuals, RCA reports | SharePoint | On document change (webhook-triggered re-index within 15 minutes) | Documents must carry EquipmentType/Model metadata for retrieval relevance. |
| Model prediction log | SQL Database (`fact_failure_predictions`) | Written on every inference cycle | Must include model_version and generated_at for traceability. |

## Stakeholders & Roles

| Role | Responsibility |
|---|---|
| Plant Maintenance Manager (Business Owner) | Owns the business case, KPI targets, and prioritization of equipment onboarding. |
| Maintenance Engineer | Reviews and validates AI-generated diagnoses and root-cause hypotheses; provides field-observation feedback. |
| Maintenance Technician | Executes approved repairs using retrieved SOPs; provides closing-report input. |
| Maintenance Planner | Approves and schedules recommended maintenance actions against crew and parts constraints. |
| Plant Manager | Consumes weekly risk/performance briefings; escalation point for critical, high-cost risk items. |
| Manufacturing AI Platform Lead (Technical Owner) | Owns model performance, connector reliability, and platform architecture. |
| IT/OT Security | Owns connector credential management, network segmentation, and PKI for OPC-UA certificates. |

## Assumptions & Constraints

- In-scope equipment already has functioning OPC-UA-accessible sensors (vibration, temperature, current, or pressure) or an OPC-UA gateway bridging legacy protocols; equipment with no instrumentation is out of scope until instrumented.
- SAP PM equipment master data (criticality class, functional location hierarchy) is reasonably current; data-quality remediation may be required in Phase 1 (see Implementation Guide.md).
- At least 12 months of historical sensor and maintenance data is available for initial model training/calibration; equipment with insufficient history will initially rely more heavily on statistical control limits than on trained RUL models.
- The organization has an existing Microsoft 365 tenant (Teams, Outlook, SharePoint) with an Azure AD app registration process available for connector onboarding.
- The AI platform does not have, and will never be granted, write access to PLC setpoints or control logic — this is a hard OT-safety constraint, not a configurable option.
- Model outputs are advisory; final accountability for maintenance decisions remains with human roles per the RACI in `Business Process.md`.

## Acceptance Criteria

| Acceptance Criterion | Maps to Requirement(s) |
|---|---|
| Given live OPC-UA telemetry for a pilot equipment set, the system produces an anomaly score update at least every 15 minutes with no more than 60 seconds processing lag from data arrival. | FR-1, FR-2, NFR-1 |
| Given at least 12 months of historical data for a pilot pump/motor asset, the system produces a RUL estimate with a stated confidence interval, refreshed at least daily. | FR-3 |
| Given a synthetic or historical anomaly event exceeding threshold, the system automatically produces a ranked failure-mode list within the Fault Diagnosis skill's designed response time and delivers a Teams risk briefing within 5 minutes. | FR-4, FR-8, NFR-2 |
| Given a diagnosed fault, the Root Cause Analysis output cites at least one retrieved SharePoint RCA report or OEM document, or explicitly states no comparable precedent was found. | FR-5, NFR-7 |
| Given a diagnosed fault, the SOP Retrieval output returns the specific section (not just the document title) relevant to the fault. | FR-6 |
| Given an approved diagnosis, the Maintenance Planner output includes a recommended action window, resourcing, and an explicit parts-availability statement sourced from SAP PM. | FR-7 |
| No SAP PM notification, work order, or closure is created without a logged human approval action. | FR-10, FR-11, NFR-6, NFR-9 |
| Every delivered diagnostic and root-cause statement includes a citation to source telemetry, historical record, or document. | NFR-7 |
| On simulated OPC-UA or SQL connector outage, the system serves cached data with a visible staleness indicator rather than failing silently. | NFR-10 |
| Weekly risk-and-performance summary is delivered to the Plant Manager distribution list every 7 days without manual intervention. | FR-13 |
