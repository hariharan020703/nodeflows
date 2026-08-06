# Implementation Guide: Maintenance Documentation & Work Order Assistant

## Prerequisites

**Systems**
- SAP PM (ECC or S/4HANA) with API_MAINTNOTIFICATION, API_MAINTENANCEORDER, and API_EQUIPMENT OData services exposed via SAP Gateway (or SAP PI/PO middleware for legacy landscapes), consistent with `Shared-Library/Connectors/SAP-PM.md`.
- Microsoft 365 tenant with SharePoint Online, Microsoft Teams, and Exchange Online (Outlook) provisioned, and Azure AD administrative access to register app registrations/bot registrations for the connectors.
- A speech-to-text (ASR) service, an OCR service, and a vision-language model (VLM) endpoint available to the orchestration platform — either via the enterprise's chosen LLM/AI platform (e.g., Azure OpenAI, Claude on Bedrock, or an on-prem LLM gateway) or dedicated ASR/OCR/VLM services integrated into the same pipeline.

**Access**
- A dedicated SAP service communication user (e.g., `SVC_AI_MAINT`) with read access to equipment/functional location/order data across in-scope plants and restricted write access limited to notification and work-order creation.
- Azure AD app registrations: one scoped to SharePoint (`Sites.Read.All` for the SOP/RCA sites, `Sites.ReadWrite.All` scoped to the AI-Generated archive library), one for Outlook (`Mail.Send`/`Mail.Read` on a dedicated service mailbox, e.g., `maintenance-docs-ai@company.com`), and an Azure Bot registration for Teams, installed only on the specific shift/maintenance channels being onboarded.
- Technician and maintenance engineer accounts provisioned with Teams mobile app access (or an equivalent submission channel) for voice/photo/note capture.

**Data Readiness**
- SAP PM equipment master and functional location data current and complete for in-scope plants (equipment IDs, functional locations, descriptions) — incomplete master data directly degrades the Work Order Generator's ability to pre-populate fields (FR-6).
- SharePoint SOP/OEM manual/RCA report libraries populated and access-controlled for the plants in scope, to support RAG grounding.
- A representative sample of historical technician notes, voice memos, and photos (or the Sample Data provided in this folder as a stand-in) available for model tuning/validation before pilot.

## Phased Implementation Plan

| Phase | Duration | Key Activities | Deliverables |
|---|---|---|---|
| 1. Discovery | 3–4 weeks | Validate plant-specific baseline documentation time, SAP data-completeness rates, and handover quality against the illustrative KPI ranges in Business Process.md; confirm equipment master data quality; select pilot plant/lines; identify maintenance-vocabulary terms for ASR tuning. | Discovery report with plant-specific baselines and pilot scope confirmation. |
| 2. Data Integration | 3–5 weeks | Register and test SAP PM, SharePoint, Teams, and Outlook connectors in a sandbox environment; validate equipment master lookups and duplicate-check queries; build the SharePoint RAG index for pilot-plant SOPs/RCA reports. | Working connector integrations validated against Sample Data; RAG index live for pilot scope. |
| 3. Skill / Model Build | 4–6 weeks | Configure/tune ASR maintenance-vocabulary correction; validate OCR handwriting recognition against sample technician handwriting; calibrate VLM photo-consistency scoring thresholds; implement and prompt-tune the four skills (Report Writer, Voice-to-Report, Work Order Generator, Shift Summary Generator) per Prompt Library.md; build the human-review adaptive-card UI in Teams. | Functional skill pipeline passing unit/integration tests against Sample Data. |
| 4. Pilot | 6–8 weeks | Run shadow-mode validation (drafts generated but not written back) for 2 weeks, then live pilot with human review gates active on one plant/line group; collect technician/engineer feedback; measure documentation time, SAP data completeness, and handover quality against Discovery baselines. | Pilot results report; go/no-go decision for rollout. |
| 5. Rollout | 4–8 weeks (phased by plant) | Extend to remaining plants/lines; onboard additional Teams channels and distribution lists; finalize training materials and support model. | Production deployment across in-scope plants; trained user base; support runbook. |

## Environment Setup

1. **SAP PM connector registration:** Provision the `SVC_AI_MAINT`-class service user, assign authorization objects `I_QMEL` (notifications) and `I_AFVGD` (orders) scoped to in-scope plants, and register the OAuth 2.0 client-credentials app against SAP Cloud Identity Services (or configure Basic Auth + communication user for on-prem Gateway). Validate with a read-only equipment master query before enabling write scopes.
2. **SharePoint connector registration:** Register the Azure AD app with certificate-based client credentials, grant `Sites.Read.All` and scope `Sites.ReadWrite.All` to the specific AI-Generated document library path (e.g., `/sites/PlantA-Maintenance/AI-Generated`), and configure the Graph webhook subscription for document-change-triggered re-indexing.
3. **Microsoft Teams connector registration:** Register the Azure Bot, install it at the team/channel level for each pilot shift channel (e.g., "Plant A – Maintenance Shift Channel"), and configure the Bot Framework activity handler to route adaptive-card button responses back to the orchestrator.
4. **Outlook connector registration:** Register the Azure AD app for the dedicated service mailbox, grant `Mail.Send` (and `Mail.Read` only if inbound ingestion is enabled), and configure the outbound HTML template with the required AI-generated-content disclaimer footer.
5. **Sandbox-to-production promotion:** Validate all four connectors against a sandbox/test SAP PM client and a test SharePoint site/Teams channel using the Sample Data files in this folder; only promote credentials to production SAP PM and production Microsoft 365 tenant scopes after passing the Testing Strategy criteria below.
6. **Model endpoint configuration:** Configure ASR, OCR, and VLM endpoint credentials and rate limits in the orchestration platform; load the maintenance-vocabulary correction list (equipment nicknames, part numbers, trade jargon) identified during Discovery.

## Testing Strategy

- **Unit testing:** Validate each skill independently against the Sample Data records — e.g., feed `technician_notes.csv` rows into Work Order Generator and confirm the drafted notification correctly populates equipment_id, a plausible failure mode, and cites the source note_text; feed `work_order_completion.csv` rows into Report Writer and confirm labor_hours/parts_used are correctly reflected.
- **Integration testing:** Validate the full pipeline end-to-end in the sandbox environment — submit a synthetic voice memo + note + photo bundle and confirm it produces a reviewable draft, that approval triggers the correct SAP PM sandbox write, and that rejection routes back to regeneration correctly.
- **UAT (User Acceptance Testing):** A small group of pilot-plant technicians, maintenance engineers, and a shift supervisor exercise the assistant against real (or realistic re-created) work scenarios, validating that transcription accuracy, photo-consistency flagging, and generated document quality meet a defined acceptance bar (e.g., ≥ 90% of drafts require only minor edits, not full rewrites).
- **Shadow-mode validation:** Run the assistant in parallel with the existing manual process for a minimum of 2 weeks, generating drafts that are reviewed and scored by maintenance engineers but not yet written back to production SAP PM, to validate accuracy and calibrate VLM consistency thresholds against `shift_log.csv` and `work_order_completion.csv` patterns before enabling live write-back.
- **Regression testing on model updates:** Any ASR/OCR/VLM/LLM model version change is re-validated against the same Sample Data test set and a held-out sample of shadow-mode submissions before promotion, per NFR-9.

## Change Management & Training Plan

| Audience | Training Focus | Format |
|---|---|---|
| Technicians | How to submit voice/note/photo evidence via the Teams channel; how to review and approve/edit a drafted work order in an adaptive card; what "good" photo evidence looks like for reliable VLM assessment. | Short in-person/video walkthrough (30–45 min) plus a one-page quick reference card. |
| Maintenance Engineers | Reviewing and approving completion reports; adjudicating photo-evidence discrepancy flags; understanding source-trace citations for audit purposes. | Hands-on workshop (60–90 min) using Sample Data scenarios. |
| Shift Supervisors | Reviewing/editing/approving the shift handover summary; escalation procedure for unresolved open items. | Hands-on workshop (60 min) plus a shadow-shift with a peer already trained. |
| Planners / Plant Management | Interpreting handover summaries and SAP data-completeness improvements; new KPI dashboard orientation. | Briefing session (30 min). |
| IT / Security | Connector credential management, audit log review process, incident response for a flagged data-quality or approval-bypass anomaly. | Technical runbook handoff session. |

Change management should explicitly address the cultural shift from "documentation happens after the work, from memory" to "documentation is drafted from what I already captured, and I just review it" — framing the assistant as reducing paperwork burden, not adding a new reporting obligation, is critical to adoption.

## Go-Live Checklist

- [ ] SAP PM, SharePoint, Teams, and Outlook connectors validated in production with least-privilege credentials (no sandbox credentials remaining in production configuration).
- [ ] Equipment master and functional location data confirmed current for all go-live plants.
- [ ] SharePoint RAG index built and refreshing correctly for go-live plants' SOP/OEM/RCA libraries.
- [ ] Maintenance-vocabulary list loaded and validated against a sample of go-live-plant technician speech patterns.
- [ ] Human-review adaptive-card UI tested end-to-end in the production Teams channels for each go-live plant/shift.
- [ ] Shadow-mode validation period completed with acceptance criteria met (≥ 90% of drafts requiring only minor edits, duplicate-detection false-negative rate acceptable).
- [ ] Audit logging confirmed operational for all four write-back/distribution paths.
- [ ] Escalation/fallback channels (Teams-to-Outlook, Outlook-to-Teams, SharePoint-upload-failure-to-email-attachment) tested.
- [ ] All in-scope technicians, engineers, and shift supervisors have completed training per the Change Management plan.
- [ ] Rollback plan (Plugin/PLUGIN_GUIDE.md) reviewed and confirmed executable by the on-call Manufacturing AI Platform team.
- [ ] Baseline KPI measurements captured immediately prior to go-live for post-launch comparison.

## Post-Go-Live Support Model

- **Monitoring:** Continuous monitoring of transcription/OCR/VLM confidence scores, draft-to-approval edit-distance (a proxy for draft quality), SAP PM write-back success rate, and connector error rates, surfaced on an operations dashboard reviewed daily by the Manufacturing AI Platform Lead during the first 4 weeks post-go-live, then weekly thereafter.
- **Escalation:** Connector authorization failures or persistent write-back errors escalate automatically to the IT/Security on-call queue; systematic draft-quality issues (e.g., recurring VLM false-positive mismatch flags for a specific photo lighting condition) escalate to the Manufacturing AI Platform Lead for model recalibration.
- **Continuous improvement cadence:** Monthly review of KPI trends (documentation time, SAP data completeness, handover quality) against Business Process.md targets; quarterly review of the maintenance-vocabulary list and prompt templates (Prompt Library.md governance section) to incorporate new equipment, terminology, or technician feedback.
- **User feedback loop:** An in-Teams "flag this draft" action lets technicians/engineers report a poor-quality draft directly to the model-tuning backlog, closing the loop between production usage and skill/prompt refinement.
