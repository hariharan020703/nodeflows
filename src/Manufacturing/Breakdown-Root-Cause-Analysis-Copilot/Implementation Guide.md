# Implementation Guide — Breakdown Root Cause Analysis Copilot

## Prerequisites

**Systems:**
- SAP PM (ECC or S/4HANA) with `API_MAINTNOTIFICATION`, `API_MAINTENANCEORDER`, and `API_EQUIPMENT` OData services activated, or SAP PI/PO middleware exposing equivalent interfaces for legacy ECC landscapes.
- MES (Siemens Opcenter, Rockwell FactoryTalk, AVEVA MES, or equivalent) with a REST/SOAP reporting API or B2MML/ISA-95 message bus accessible for downtime, production order, and shift/operator data.
- Process Historian (AVEVA/Wonderware, Honeywell PHD, GE Proficy, or PI-based) with REST/SDK access and an existing (or buildable) tag-to-equipment mapping table.
- Microsoft 365 tenant with SharePoint Online (target sites identified, e.g., `/sites/PlantA-Maintenance`) and Microsoft Teams (target maintenance channel identified).
- Approved enterprise LLM/embedding deployment (Azure OpenAI, Claude on Bedrock, or on-prem gateway) cleared for internal operational data per the organization's AI governance policy.

**Access:**
- Dedicated least-privilege service accounts: SAP PM (`SVC_AI_MAINT` with `I_QMEL`/`I_AFVGD` scoped write authorization), MES reporting role (read-only), Historian read-only role scoped to relevant tag groups, Azure AD app registrations for SharePoint (`Sites.Read.All` + scoped `Sites.ReadWrite.All`) and Teams (Azure Bot registration installed at the target channel level).
- Sign-off from SAP Basis, MES administration, Historian/OT administration, and M365 administration on service account provisioning.

**Data readiness:**
- Equipment Master and Functional Location hierarchy in SAP PM is current for all in-scope assets.
- MES equipment/line IDs are mapped to SAP PM Equipment IDs (a cross-reference table if the two systems use different identifiers).
- Historian tag list is mapped to Equipment IDs for all in-scope assets (vibration, temperature, pressure, flow, or equipment-specific equivalents).
- At least 6–12 months of historical SAP PM notification/order data available for MTBF/MTTR baselining and initial vector index seeding; existing RCA reports (even informal Word/Excel ones) collected for migration into SharePoint if not already there.

## Phased Implementation Plan

| Phase | Duration | Key Activities | Deliverables |
|---|---|---|---|
| 1. Discovery | 3 weeks | Confirm in-scope equipment/lines; validate SAP PM/MES/Historian data quality and ID mappings; identify target SharePoint sites and Teams channels; finalize KPI baselines | Discovery report; equipment scope list; data quality assessment; KPI baseline document |
| 2. Data Integration | 4 weeks | Register all 5 connectors per canonical specs; build/validate MES-to-SAP equipment ID mapping; build/validate Historian tag-to-equipment mapping; stand up Investigation Context Store (staging SQL) | Working connector integrations in a sandbox environment; validated ID mapping tables; staging schema deployed |
| 3. Skill / Model Build | 5 weeks | Implement Incident Timeline Builder join logic; build/seed the historical RCA vector index (embed existing RCA reports and SOPs); implement RCA Analyzer prompt with structured-output schema and citation enforcement; implement Corrective Action Generator and report template | Functioning skill pipeline in sandbox; seeded vector index; validated structured-output schema |
| 4. Pilot | 6 weeks | Run end-to-end on live breakdowns for 2–3 pilot lines in shadow mode (draft delivered to engineers for feedback, no write-back), then move to live write-back with human approval; tune confidence thresholds and similarity threshold | Shadow-mode validation report; tuned thresholds; pilot go/no-go decision |
| 5. Rollout | 4–8 weeks (phased by line/plant) | Expand to remaining in-scope lines/plants; conduct training sessions; finalize escalation/on-call model; establish continuous improvement cadence | Production rollout across full scope; training completion records; support model document |

## Environment Setup Steps

1. Register the SAP PM connector: create the `SVC_AI_MAINT` communication user, assign `I_QMEL`/`I_AFVGD` authorization objects scoped to write on notification/order completion fields only, configure OAuth 2.0 client-credentials against SAP Cloud Identity Services (or Basic Auth + communication user for on-prem Gateway), and validate with a read-only test query against a non-production equipment record.
2. Register the MES connector: obtain a read-only reporting API key or OAuth client credentials scoped to downtime/production/shift objects; validate with the sample query pattern (`GET /mes/api/v1/downtime-events?line=...&from=...&to=...`) against a test line.
3. Register the Historian connector: establish Kerberos or OAuth/API-key access scoped to the relevant tag groups; validate a time-windowed `RecordedValues` query against a known historical incident window.
4. Register the SharePoint connector: create an Azure AD app registration with `Sites.Read.All` (delegated/application) for the target sites and a scoped `Sites.ReadWrite.All` limited to the "AI-Generated RCA Reports" subfolder; configure certificate-based client credential flow; validate with a test document upload and retrieval.
5. Register the Microsoft Teams connector: create an Azure Bot registration, have a Teams admin install the bot at the target maintenance channel(s) only; validate with a test Adaptive Card post and a test button-click round-trip.
6. Deploy the Investigation Context Store (staging SQL schema) and the vector index infrastructure; run the initial historical RCA/SOP embedding batch job to seed the index.
7. Configure the Investigation Orchestrator with the trigger rules (SAP PM notification event filter, MES critical-downtime threshold), default time window (±8 hours), and escalation recipients.
8. Promote from sandbox to production only after: (a) all 5 connectors pass their validation query in the production tenant/landscape with production service accounts, (b) the shadow-mode pilot (Phase 4) has met the accuracy and timeliness thresholds defined in the Testing Strategy below, and (c) IT/Security has signed off on the security and availability review referenced in Business Requirements NFR-2/3/4.

## Testing Strategy

| Test Level | Approach |
|---|---|
| Unit | Each skill tested independently against the `Sample Data/` files: Incident Timeline Builder joins `incident_log.csv`, `mes_downtime_events.csv`, and `historian_sensor_trend.csv` and is verified to correctly sequence the sample Pump P-301 incident (equipment `10004521`, malfunction start `2026-08-04T03:12:00Z`) with no unexpected gaps. |
| Integration | End-to-end pipeline run against a sandbox copy of all 5 connectors using the sample data plus a seeded set of 10–15 historical RCA report stubs, verifying the full chain from trigger through Teams card delivery. |
| UAT | Maintenance engineers at the pilot lines run the Copilot against 10+ real historical breakdowns (re-triggered manually via FR-13) and score the draft timeline, root cause ranking, and corrective actions for accuracy and usefulness against their own recollection/records. |
| Shadow-Mode Validation | For the first 4–6 weeks of Phase 4, the Copilot runs on every live breakdown but only posts drafts to Teams for engineer feedback — no write-back is enabled. Draft quality (correct root cause identified in top-2 ranked hypotheses) is tracked against the engineer's eventual manual conclusion; go-live to live write-back requires ≥80% top-2 accuracy across at least 15 shadow-mode incidents. |
| Regression | Any change to the RCA Analyzer prompt or structured-output schema is re-validated against a fixed regression set of the sample data plus 5 historical shadow-mode incidents before redeployment. |

## Change Management & Training Plan

- **Technicians:** Brief, one-session training (30 minutes) on what changes for them: notification creation fields matter more now (accurate malfunction start time), and they may be consulted for evidence via a Teams reply if the Copilot flags a data gap.
- **Maintenance Engineers:** Half-day hands-on training covering how to read the Adaptive Card summary, how to use Edit/Add Evidence to correct or supplement the AI's timeline and ranking, when to Reject and fall back to manual investigation, and their continued accountability for the final root cause conclusion.
- **Planners:** Awareness session on how published RCA reports and corrective actions feed into preventive maintenance planning and spares forecasting.
- **Plant Manager / Reliability Engineer:** Briefing on the new KPI dashboard (RCA cycle time, top-2 accuracy, repeat breakdown rate) and how to review published RCA reports in SharePoint.
- **Champions network:** Identify one "power user" engineer per pilot line to provide peer support and feedback during Phase 4, escalating recurring friction points to the Maintenance AI/Digital Solutions Lead.
- **Communication cadence:** Weekly pilot feedback session during Phase 4; monthly steering review during Phase 5 rollout.

## Go-Live Checklist

- [ ] All 5 connectors validated in production with production service accounts and least-privilege scopes confirmed.
- [ ] MES-to-SAP equipment ID mapping and Historian tag-to-equipment mapping reviewed and signed off by plant engineering.
- [ ] Vector index seeded with all available historical RCA reports and current SOPs/manuals for in-scope equipment.
- [ ] Shadow-mode pilot achieved ≥80% top-2 root cause accuracy across at least 15 incidents.
- [ ] Human-in-the-loop approval gate tested and confirmed blocking for both SAP PM write-back and SharePoint publish paths.
- [ ] Partial-data confidence capping (NFR-7) verified by simulating a Historian outage during a test run.
- [ ] Audit logging verified capturing actor, timestamp, evidence set, and approver identity for a test write-back.
- [ ] Teams Adaptive Card delivery and Approve/Edit/Reject round-trip verified in the production tenant.
- [ ] Escalation paths (SAP PM/SharePoint write failure, Teams delivery failure) tested end-to-end.
- [ ] All pilot-line engineers, technicians, and the reliability engineer have completed training.
- [ ] KPI baseline (MTTR, RCA completion rate, repeat breakdown rate) documented for post-go-live comparison.
- [ ] Rollback plan (see Plugin/PLUGIN_GUIDE.md) reviewed and understood by the on-call support team.

## Post-Go-Live Support Model

- **Monitoring:** Connector health (SAP PM/MES/Historian/SharePoint/Teams call success rate and latency) monitored on a dashboard with alerting on sustained failure or SLA breach (per NFR-1/NFR-2); vector index refresh lag monitored against the 15-minute target.
- **Escalation:** Tier 1 (connector/technical failures) routes to the Maintenance AI/Digital Solutions Lead; Tier 2 (persistent data quality issues, e.g., stale ID mappings) routes to the relevant system owner (SAP Basis, MES admin, Historian admin); Tier 3 (model accuracy/quality concerns raised by engineers) routes to a monthly model-quality review.
- **Continuous improvement cadence:** Monthly review of top-2 root cause accuracy, RCA cycle time, and engineer feedback (edit/reject rate and reasons); quarterly re-tuning of the similarity threshold and structured-output schema based on accumulated shadow-mode and production outcomes; the growing historical RCA vector index is expected to improve match quality over time, so accuracy trends should be tracked as a leading indicator of ROI.
- **Governance review:** Semi-annual audit of write-back logs and approval records to confirm the human-in-the-loop gate has not been bypassed and that write-back scope has not silently expanded beyond the approved fields/folders.
