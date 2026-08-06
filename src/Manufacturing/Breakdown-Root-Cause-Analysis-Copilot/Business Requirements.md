# Business Requirements — Breakdown Root Cause Analysis Copilot

## Objective

Deploy an AI-assisted copilot that, upon creation of a breakdown notification or a critical downtime event, automatically assembles a multi-source incident timeline, identifies and ranks probable root causes with cited supporting evidence, and drafts corrective action recommendations — reducing the engineer-hours required to produce a defensible RCA from 4–8 hours to under 30 minutes of review/correction time, while keeping a human maintenance engineer as the final decision authority on every root cause conclusion and every system write-back.

## In-Scope
- Breakdown events on equipment tracked in SAP PM with a Functional Location and Equipment Master record.
- Automated retrieval and cross-system joining of SAP PM notifications/orders, MES downtime events, and Historian sensor trend data for a configurable time window around the breakdown.
- Embedding-based similarity search against historical RCA reports and SOPs stored in SharePoint.
- LLM-based causal reasoning to produce ranked, evidence-cited root cause hypotheses and a 5-Why analysis.
- Draft generation of corrective action plans (immediate containment and preventive) and management-facing RCA reports.
- Human-in-the-loop review and approval via Microsoft Teams before any write-back to SAP PM or publication to SharePoint.
- Initial pilot scope: mechanical and electrical breakdowns on rotating and conveying equipment (pumps, motors, conveyors, gearboxes) across up to three production lines at one plant, expanding to additional equipment classes and plants in subsequent phases.

## Out-of-Scope
- Real-time predictive failure detection / early-warning alerting prior to breakdown (covered by the separate Predictive Maintenance Assistant use case).
- Automated preventive maintenance schedule generation or optimization (covered by the Preventive Maintenance Planning Assistant use case).
- Spare parts availability checking or procurement triggering (covered by the Spare Parts Intelligence Assistant use case).
- Autonomous closure of SAP PM notifications or work orders without human approval.
- Safety incident investigation workflows governed by EHS regulatory reporting requirements (the Copilot may be consulted for equipment-related evidence but does not replace the formal EHS incident investigation process).
- Root cause analysis for quality-only deviations with no equipment breakdown (handled by Quality department tooling).

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | The system shall detect creation of a new SAP PM breakdown notification (BreakdownIndicator = true) or a critical MES downtime event above a configurable duration threshold, and automatically initiate an RCA investigation within 2 minutes of detection. |
| FR-2 | The system shall retrieve MES downtime events, Historian sensor trend data, and SAP PM notification/order history for the affected `equipment_id` across a configurable time window (default ±8 hours around the malfunction start time). |
| FR-3 | The system shall join the retrieved records from all three sources into a single, time-ordered incident timeline keyed on `equipment_id` and timestamp, and shall explicitly flag any time interval where a source system returned no data (`data_gap = true`) rather than treating the absence of data as a normal-operation signal. |
| FR-4 | The system shall retrieve relevant SOPs, OEM manuals, and prior notification/work order history for the equipment's functional location from SharePoint and SAP PM to ground the analysis in approved reference material. |
| FR-5 | The system shall run an embedding-based similarity search of the reconstructed incident (equipment type, failure description, sensor signature) against a vector index of historical RCA reports and shall return the top-N (default 5) most similar historical breakdowns with a similarity score. |
| FR-6 | The system shall produce a ranked list of probable root causes (minimum 2, maximum 5) for the breakdown, each with a qualitative confidence level (High/Medium/Low) and at least one citation to a specific timeline event, sensor reading, or historical RCA report supporting that hypothesis. |
| FR-7 | The system shall generate a 5-Why analysis grounded in the reconstructed timeline and ranked root causes upon request. |
| FR-8 | The system shall draft an immediate containment action and a longer-term preventive corrective action recommendation tied to the top-ranked root cause. |
| FR-9 | The system shall generate a management-ready RCA report (equipment, incident summary, timeline, root cause ranking, corrective actions, evidence appendix) in a standard template. |
| FR-10 | The system shall deliver the draft timeline, ranked root causes, and corrective action plan to the responsible maintenance engineer via a Microsoft Teams Adaptive Card, with Approve, Edit/Add Evidence, and Reject actions. |
| FR-11 | The system shall NOT write the root cause or corrective action back to SAP PM, nor publish the RCA report to SharePoint, until an authorized maintenance engineer has explicitly approved the draft. |
| FR-12 | Upon engineer approval, the system shall write the approved root cause and corrective action summary back to the SAP PM notification/work order as a completion note, and shall publish the final RCA report to a designated "AI-Generated RCA Reports" SharePoint subfolder tagged with equipment, incident ID, and root cause category for future retrieval. |
| FR-13 | The system shall allow an engineer to manually invoke the Copilot on-demand for a given `equipment_id` and time window, independent of an automatic notification trigger (e.g., for a breakdown logged retroactively). |
| FR-14 | The system shall maintain a persistent index of every published RCA report so it becomes searchable for future Failure Pattern Matcher queries. |

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | The system shall deliver an initial draft timeline and ranked root causes within 15 minutes of the triggering breakdown notification for 95% of investigations under the default ±8 hour data window. |
| NFR-2 | The system shall be available 99.5% of the time during production hours across all shifts at the deployed plant(s). |
| NFR-3 | All connector authentication shall use OAuth 2.0 client-credentials or certificate-based flows per the canonical connector specs; no credentials shall be stored in plaintext in prompts, logs, or the vector index. |
| NFR-4 | All data retrieved and generated (timelines, root cause analyses, RCA reports) shall remain within the customer's designated data residency boundary (e.g., customer's Azure tenant / private model endpoint); no maintenance or sensor data shall be sent to a public, non-contracted LLM endpoint. |
| NFR-5 | Every root cause hypothesis presented to an engineer shall include at least one explicit, traceable citation to a source record (SAP PM notification number, MES event ID, Historian tag + timestamp, or SharePoint document reference) so no conclusion is presented without evidence — explainability is a hard requirement, not a nice-to-have. |
| NFR-6 | Every write-back action (SAP PM notification update, SharePoint publish) shall generate an immutable audit record capturing the acting agent, timestamp, input evidence set, and the human approver's identity. |
| NFR-7 | The system shall degrade gracefully when a source system is unavailable: it shall clearly label the investigation as based on partial data, list which source was unavailable, and shall not present a root cause ranking with a confidence level higher than "Medium" when a required source (MES or Historian) was unavailable for the incident window. |
| NFR-8 | The vector index of historical RCA reports shall be re-indexed within 15 minutes of a new RCA report being published, consistent with the SharePoint connector's change-notification refresh target. |

## Data Requirements

| Data | Source | Frequency / Freshness | Quality Requirement |
|---|---|---|---|
| Breakdown notifications, equipment master, order history | SAP PM (`API_MAINTNOTIFICATION`, `API_EQUIPMENT`) | Near-real-time on notification creation; batch nightly sync for historical MTBF/MTTR | Equipment ID and Functional Location must be populated; malfunction start time required |
| Downtime events, reason codes, shift/operator logs | MES | Near-real-time / polling every 1–5 minutes | Line and equipment ID required; missing/late events flagged as `data_gap`, not assumed absent |
| Sensor trend data (vibration, temperature, pressure, flow) | Historian Database | Time-windowed query on demand, ±8h default | Distinguish raw recorded vs. interpolated values; tag-to-equipment mapping must be current |
| SOPs, OEM manuals, historical RCA reports | SharePoint | Vector index refreshed within 15 min of document change | Documents must carry equipment type / model metadata for retrieval relevance |
| Approval / rejection / comment actions | Microsoft Teams | Real-time (Bot Framework activity) | Action payload must correlate to the originating incident via `conversationId` |

## Stakeholders & Roles

| Role | Responsibility |
|---|---|
| Plant Maintenance Manager | Business owner; accountable for adoption, KPI outcomes, and escalation policy. |
| Maintenance Engineer | Primary end user; reviews, corrects, and approves every AI-generated RCA draft before write-back. |
| Reliability Engineer | Consumes published RCA reports to identify systemic/repeat failure patterns and drive preventive maintenance changes. |
| Maintenance Technician | Provides the initial breakdown notification and on-the-ground context; may be consulted for evidence the AI could not access. |
| Plant Manager | Reviews management-facing RCA reports for significant breakdowns; accountable for cross-functional corrective action follow-through. |
| Maintenance AI/Digital Solutions Lead | Technical owner; accountable for connector health, model performance, and plugin configuration. |
| IT/Security (SAP Basis, M365 Admin) | Provisions and secures service accounts, API access, and Azure AD app registrations for connectors. |

## Assumptions & Constraints
- SAP PM notifications reliably carry the `BreakdownIndicator` flag and an `Equipment` field; equipment lacking a maintained Equipment Master record cannot be automatically investigated.
- The MES exposes downtime events with `equipment_id`/line tagging consistent enough to join against SAP PM equipment IDs (a mapping table is required where IDs differ between systems).
- Historian tag naming conventions map to equipment via an existing or newly built tag-to-asset lookup table; this mapping is a Phase 2 (Data Integration) dependency, not assumed to pre-exist.
- A minimum of 6–12 months of historical SAP PM notification/order data and Historian trend data is available to seed the initial failure-signature vector index; cold-start accuracy will be lower for equipment/failure modes with fewer than 3 historical precedents.
- The organization has an existing Microsoft 365 tenant with SharePoint and Teams, and an existing or newly registered Azure Bot for Teams integration.
- The LLM/embedding model runs on an approved enterprise deployment (Azure OpenAI, Bedrock, or on-prem gateway) already cleared for handling internal operational data.
- Engineers retain override authority; the Copilot's ranking is a recommendation, not a directive, and can be fully overridden or discarded.

## Acceptance Criteria

| Mapped Requirement(s) | Acceptance Criterion |
|---|---|
| FR-1, NFR-1 | Given a new SAP PM breakdown notification with `BreakdownIndicator = true`, the Copilot initiates data collection within 2 minutes and delivers a draft timeline + ranked root causes within 15 minutes, for at least 95% of test incidents in UAT. |
| FR-2, FR-3 | Given the sample incident (equipment `10004521`, malfunction start `2026-08-04T03:12:00Z`), the Copilot's reconstructed timeline includes matching entries from `incident_log.csv`, `mes_downtime_events.csv`, and `historian_sensor_trend.csv`, correctly ordered by timestamp, with any missing 15-minute interval explicitly flagged `data_gap = true`. |
| FR-4, FR-5 | Given the sample incident, Knowledge Base Search returns the equipment's pump SOP/manual, and Failure Pattern Matcher returns at least one prior bearing-failure RCA report on comparable rotating equipment with a similarity score ≥ 0.75. |
| FR-6, NFR-5 | The ranked root cause list for the sample incident includes at least 2 hypotheses, each with a confidence level and at least one citation to a specific historian tag/timestamp, MES event, or SAP PM record; no hypothesis is presented without a citation. |
| FR-7 | On request, a 5-Why analysis is generated that traces from the immediate symptom (e.g., "pump tripped on high vibration") down to the identified root cause, with each "why" referencing timeline evidence. |
| FR-8, FR-9 | The draft RCA report includes an immediate containment action, a preventive corrective action, and a complete report structure (summary, timeline, root cause ranking, corrective actions, evidence appendix) reviewable in under 10 minutes by an engineer. |
| FR-10, FR-11 | The Teams Adaptive Card is delivered to the correct maintenance channel with functioning Approve / Edit / Reject actions, and no SAP PM write-back or SharePoint publish occurs prior to an Approve action being logged. |
| FR-12, NFR-6 | Upon Approve, the SAP PM notification receives a completion note within 5 seconds, the RCA report is published to the "AI-Generated RCA Reports" SharePoint subfolder with equipment/incident/root-cause tags, and an audit record is created capturing agent, timestamp, evidence set, and approver identity. |
| FR-13 | An engineer can manually trigger an investigation for a specified `equipment_id` and time window without a preceding automatic notification, and receives an equivalent draft output. |
| NFR-7 | With the Historian connector simulated as unavailable, the Copilot still produces a draft investigation, clearly labels it as based on partial data, lists Historian as unavailable, and caps confidence at "Medium" or lower. |
| NFR-2, NFR-3, NFR-4 | Connector authentication, uptime, and data residency are validated in a pre-go-live security and availability review sign-off prior to production rollout. |
