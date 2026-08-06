# Implementation Guide — Predictive Maintenance Assistant

## Prerequisites

**Systems:**
- SAP PM (ECC or S/4HANA) with OData services `API_MAINTNOTIFICATION`, `API_MAINTENANCEORDER`, `API_EQUIPMENT` enabled, or SAP PI/PO middleware for legacy landscapes.
- SQL Database platform provisioned for the analytics/staging layer (SQL Server, PostgreSQL, Snowflake, or Azure SQL).
- OPC-UA server or gateway (Kepware/Ignition) exposing shop-floor tags, with an edge collector deployed in the OT/IT DMZ.
- Microsoft 365 tenant with SharePoint Online, Microsoft Teams, and Exchange Online (Outlook) provisioned.
- LLM platform access (Azure OpenAI / Claude on Bedrock / on-prem LLM gateway, or Claude Code/Cowork per `Plugin/PLUGIN_GUIDE.md`).

**Access:**
- SAP service communication user (`SVC_AI_MAINT`) with authorization objects `I_QMEL`, `I_AFVGD` scoped per `Connectors/sap-pm/SPEC.md`.
- Azure AD app registrations for SharePoint (`Sites.Read.All`, scoped `Sites.ReadWrite.All`), Teams (Azure Bot registration), and Outlook (`Mail.Send`, `Mail.Read` on a dedicated service mailbox).
- Read-only (`svc_ai_readonly`) and write-scoped (`svc_ai_writer`) SQL service accounts.
- X.509 certificates issued by plant PKI for OPC-UA mutual authentication.

**Data readiness:**
- SAP PM equipment master criticality classification populated for all candidate in-scope equipment.
- At least 12 months of historical sensor and maintenance data available for pilot equipment (shorter history acceptable if statistical control limits are used as the initial detection method pending RUL model training).
- SharePoint SOP library and RCA archive organized with EquipmentType/Model metadata populated (remediation task if missing).

## Phased Implementation Plan

| Phase | Duration | Key Activities | Deliverables |
|---|---|---|---|
| 1. Discovery | 3–4 weeks | Validate equipment criticality list; assess sensor coverage and OPC-UA tag mapping; audit SAP PM data quality; inventory SharePoint SOP/RCA coverage; confirm KPI baselines (MTTR, MTBF, downtime %) with plant reliability team. | Discovery report; equipment onboarding list (Class A/B); data-quality remediation backlog; baseline KPI snapshot. |
| 2. Data Integration | 4–6 weeks | Deploy OPC-UA edge collector; build tag-to-equipment_id mapping table; stand up SQL staging schema (`fact_sensor_readings`, `fact_alarms`, `fact_maintenance_history`, `dim_equipment`, `fact_failure_predictions`); establish nightly SAP PM sync; index SharePoint SOP/RCA library into the vector store. | Live telemetry flowing to staging; SAP PM nightly sync validated; RAG index operational. |
| 3. Skill / Model Build | 6–8 weeks | Train/calibrate statistical control limits and Isolation Forest anomaly models per equipment class; train gradient-boosted survival model and/or LSTM/transformer RUL model where sufficient history exists; build and tune the five LLM skills and prompt library; wire orchestration logic and threshold configuration. | Validated anomaly/RUL models with documented performance (precision/recall on historical breakdown events); functioning skill chain in a sandbox environment. |
| 4. Pilot | 4–6 weeks | Run in shadow mode (no write-back) against 10–20 pilot equipment assets; compare AI risk flags against actual subsequent breakdowns/technician findings; tune thresholds to control false-positive rate; onboard pilot Teams channel and pilot user group. | Shadow-mode validation report; tuned thresholds; pilot user sign-off. |
| 5. Rollout | 6–10 weeks (phased by plant area) | Enable human-approved SAP PM write-back; expand equipment scope by criticality tier; roll out Teams/Outlook delivery plant-wide; train full technician/engineer/planner population. | Production go-live per area; trained user base; go-live checklist signed off. |

## Environment Setup Steps

1. Register the SAP PM connector: create `SVC_AI_MAINT` communication user, assign authorization objects, activate OData services, and test read/write against a non-production SAP client.
2. Provision SQL staging schema via migration scripts (Flyway/Liquibase); create `svc_ai_readonly` and `svc_ai_writer` accounts; validate schema against the field names referenced in `Technical Design.md` and `Sample Data/`.
3. Deploy the OPC-UA edge collector in the OT/IT DMZ; issue X.509 certificates; configure the tag subscription list per `Connectors/opc-ua-plc/SPEC.md`; validate 72-hour local buffering.
4. Register Azure AD applications for SharePoint, Teams (Bot Framework), and Outlook; grant the minimum required Graph API scopes; store secrets in the organization's vault (Azure Key Vault / HashiCorp Vault) — never in application code.
5. Deploy the model layer (anomaly detection, RUL estimators) and the LLM orchestration layer into the sandbox environment; connect to the SQL staging layer and the SharePoint vector index.
6. Load the five skills from `Skills/` (each a real Agent Skill folder, e.g. `Skills/fault-diagnosis/SKILL.md`) and the prompts from `Prompt Library.md` into the orchestration platform; configure the threshold values per the Configuration Reference in `Plugin/PLUGIN_GUIDE.md`.
7. Validate end-to-end in sandbox using `Sample Data/` before connecting to any live plant system.
8. Promote sandbox configuration to production following change-control sign-off; re-point connectors to production SAP/SQL/SharePoint/Teams/Outlook endpoints; re-validate credentials.

## Testing Strategy

- **Unit testing:** Validate each connector adapter independently (SAP OData calls, SQL queries, OPC-UA subscription handling, SharePoint search/upload, Teams card posting, Outlook send) against sandbox/test endpoints.
- **Model unit testing:** Backtest anomaly detection and RUL models against historical `maintenance_history.csv`-style data with known failure events; measure precision/recall and lead-time distribution.
- **Integration testing:** Run the full skill chain (Fault Diagnosis → Root Cause Analysis → SOP Retrieval → Maintenance Planner → Maintenance Report Writer) end-to-end using `Sample Data/sensor_readings.csv`, `alarm_log.csv`, and `maintenance_history.csv` as inputs, verifying correct data flow and citation integrity at each step.
- **UAT:** Maintenance engineers and planners review a batch of AI-generated risk briefings and draft notifications against real (or realistic pilot) scenarios, scoring diagnostic accuracy and usefulness of the recommended action plan.
- **Shadow-mode validation:** Run the assistant live against production telemetry with all write-backs disabled for 4–6 weeks (Pilot phase); compare AI-flagged risk events against actual subsequent maintenance events recorded in SAP PM to compute false-positive/false-negative rates before enabling write-back.
- **Regression testing on prompt/model changes:** Any change to the Prompt Library or model version is re-validated against the same Sample Data-based test suite before promotion, per the Prompt Governance section of `Prompt Library.md`.

## Change Management & Training Plan

| Audience | Training Focus | Format |
|---|---|---|
| Technicians | How to read a Teams risk briefing, interpret confidence scores, use retrieved SOP sections in the field, and provide closing-report input | 2-hour hands-on session + quick-reference card |
| Maintenance Engineers | How to validate/override AI diagnoses, interpret RUL confidence intervals, and provide feedback that improves future model calibration | Half-day workshop + shadow-mode co-review sessions during Pilot |
| Planners | How to review and approve Maintenance Planner recommendations against real crew/parts constraints, and how approvals write back to SAP PM | Half-day workshop |
| Plant Managers | How to interpret the weekly risk-and-performance briefing and escalation triggers | 1-hour briefing |
| IT/OT Security | Connector credential rotation, PKI certificate renewal cadence, and incident response for connector failures | Technical handover documentation + on-call runbook |

Change management should explicitly address trust-building: early pilot communications should be transparent that the assistant is advisory, that shadow-mode results will be shared, and that false positives during tuning are expected and will decrease over the pilot period.

## Go-Live Checklist

- [ ] All in-scope equipment has confirmed OPC-UA tag mapping and SAP PM criticality classification.
- [ ] Anomaly detection and RUL models have completed shadow-mode validation with an agreed false-positive rate threshold met.
- [ ] All six connectors (SAP PM, SQL Database, OPC-UA/PLC, SharePoint, Teams, Outlook) are validated in production with least-privilege credentials confirmed by IT/OT Security.
- [ ] Human approval workflow tested end-to-end for both notification creation and closing-report confirmation.
- [ ] Audit logging confirmed operational and retention policy configured per NFR-6.
- [ ] Fallback delivery (Teams → Outlook) tested by simulating a Teams delivery failure.
- [ ] Pilot user group (technicians, engineers, planners) trained and signed off on UAT scenarios.
- [ ] Escalation and on-call runbook published for connector or model-performance incidents.
- [ ] Rollback plan (see `Plugin/PLUGIN_GUIDE.md`) reviewed and tested in sandbox.
- [ ] Plant Manager weekly briefing distribution list confirmed and first test briefing delivered successfully.

## Post-Go-Live Support Model

- **Monitoring:** Model performance (prediction accuracy against subsequent confirmed failures), connector health (latency, error rates), and delivery success rates are monitored on an operational dashboard reviewed weekly by the Manufacturing AI Platform Lead.
- **Escalation:** Connector failures and model-confidence anomalies trigger an IT/OT on-call alert; persistent (>3 retry) failures escalate per the fallback strategy in `Technical Design.md`.
- **Continuous improvement cadence:** Monthly model recalibration review using newly closed SAP PM work orders as fresh training/labeling data; quarterly review of anomaly thresholds and RUL model performance against realized MTBF/MTTR trends; prompt library reviewed each release cycle per the Prompt Governance section in `Prompt Library.md`.
- **Feedback loop:** Maintenance Engineer overrides/rejections of AI diagnoses are logged and reviewed monthly to identify systematic model blind spots (e.g., a recurring fault signature the model consistently misclassifies).
