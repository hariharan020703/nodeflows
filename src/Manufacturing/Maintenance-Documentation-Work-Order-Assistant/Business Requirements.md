# Business Requirements: Maintenance Documentation & Work Order Assistant

## Objective

Deploy an AI assistant that converts technician voice recordings, handwritten/typed notes, and repair photos into structured SAP PM work orders, maintenance completion reports, and shift handover summaries, drafted for human review within minutes of capture, so that documentation time per shift is reduced, SAP data completeness improves, and shift handover quality becomes consistent and auditable — without removing human accountability for any system-of-record write or external distribution.

## In-Scope

- Speech-to-text transcription of technician voice memos related to maintenance work (diagnosis, repair, completion narration).
- OCR and normalization of handwritten or shorthand technician notes (paper, tablet, or clipboard entries).
- Vision-language analysis of repair/damage photos to verify visual consistency with claimed work and flag mismatches.
- Drafting of SAP PM maintenance notifications and work orders (equipment, functional location, failure mode, priority, short/long text) from the above inputs.
- Drafting of maintenance completion reports and repair completion certificates (labor hours, parts consumed, root cause narrative).
- Drafting of shift handover summaries aggregating a shift's completed and pending work orders and notable events.
- Human-in-the-loop review and approval of every drafted document prior to SAP PM write-back or external distribution.
- Full traceability of every generated field back to its source note, transcript segment, or photo.
- Delivery of drafts and final documents via Microsoft Teams (review/approval, handover distribution) and Outlook (formal report/handover distribution).
- Archival of source evidence (transcripts, notes, photos) and generated reports in SharePoint.

## Out-of-Scope

- Autonomous (non-reviewed) write-back to SAP PM or any other system of record — every write requires explicit human approval.
- Diagnostic reasoning about root cause beyond what is stated or visually evident in the technician's own inputs (this assistant documents; it does not replace the Breakdown Root Cause Analysis Copilot's independent diagnostic reasoning, though it may consume that copilot's outputs as context where both are deployed).
- Predictive maintenance scheduling, spare-parts inventory optimization, or preventive maintenance plan generation (covered by other use cases in this repository).
- Real-time equipment telemetry ingestion or anomaly detection (no OPC-UA/PLC connector in this use case).
- Payroll, timekeeping, or labor-cost system integration beyond recording labor hours on the SAP PM work order.
- Translation of technician notes/voice into languages not configured for the deployment (initial scope: English and Spanish, matching the Plant A / Plant B technician population referenced in Sample Data).

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | The system shall transcribe technician voice recordings into text with punctuation and maintenance-domain vocabulary correction (equipment nicknames, part numbers, trade terminology), producing a timestamped transcript linked to the originating audio file. |
| FR-2 | The system shall extract and normalize text from handwritten or typed technician notes (including notes captured via the `technician_notes` data source) into a structured note record containing work order reference, equipment ID, technician ID, note text, and capture timestamp. |
| FR-3 | The system shall analyze photos submitted with a repair record using a vision-language model and produce a structured assessment of whether the visual evidence is consistent with the claimed failure mode and/or completed repair, including a confidence indicator. |
| FR-4 | Where photo evidence is inconsistent with, or insufficient to support, the claimed repair narrative, the system shall flag the discrepancy for human reviewer attention rather than silently generating a report that assumes the claim is correct. |
| FR-5 | The system shall draft a SAP PM maintenance notification and/or work order populated with equipment ID, functional location, failure mode/damage code, priority, and short/long text derived from the fused voice transcript, note text, and photo assessment. |
| FR-6 | The system shall retrieve equipment master data (equipment ID, functional location, description) from SAP PM to pre-populate known fields on a drafted work order, rather than requiring the technician to re-enter them. |
| FR-7 | The system shall draft a maintenance completion report / repair completion certificate including labor hours, parts consumed, and a root cause narrative, derived from the same source inputs used for the work order draft. |
| FR-8 | The system shall present every drafted work order, notification, and completion report to a designated human reviewer (technician, maintenance engineer, or shift supervisor per role mapping) for edit and explicit approval before any write-back to SAP PM. |
| FR-9 | The system shall not write any data to SAP PM, send any Outlook email, or post any Teams message that has not received explicit human approval within the current session. |
| FR-10 | The system shall generate a shift handover summary at shift end, aggregating the shift's completed work orders, pending/open work orders, and notable events, drawn from SAP PM work order status and the shift's generated reports and technician notes (including the `shift_log` data source fields: plant, shift_date, shift_type, orders_completed, orders_pending, notable_events). |
| FR-11 | The system shall deliver the approved shift handover summary to the incoming shift via a Microsoft Teams channel post and to designated planners/plant management via Outlook email. |
| FR-12 | The system shall maintain traceability metadata on every generated document field, linking it back to the specific source note, transcript segment, or photo file used to derive it. |
| FR-13 | The system shall archive source evidence (voice transcripts, note text, photos) and the corresponding generated report in SharePoint, tagged with the work order reference and an `AI-Generated` metadata flag pending human approval status. |
| FR-14 | The system shall support both English and Spanish voice/note inputs for the initial deployment scope, producing English-normalized structured output fields for SAP PM while retaining the original-language transcript for audit purposes. |
| FR-15 | The system shall detect and surface likely-duplicate work order submissions (e.g., a second note referencing the same equipment and issue within a short time window) for reviewer confirmation before creating a duplicate SAP PM record. |

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Voice transcription shall complete within 60 seconds for a voice memo of up to 5 minutes, on the standard deployment infrastructure described in Technical Design.md. |
| NFR-2 | End-to-end draft generation (from submitted note/voice/photo to a reviewable draft work order or report) shall complete within 2 minutes for a typical single-equipment repair record. |
| NFR-3 | The assistant's review-and-approval interface (Teams adaptive card or equivalent) shall be available with 99.5% uptime during scheduled plant operating shifts. |
| NFR-4 | All connector authentication shall use OAuth 2.0 / Azure AD service principals scoped to least-privilege roles, per the Shared-Library canonical connector specs (SAP PM, SharePoint, Microsoft Teams, Outlook) — no shared or personal credentials. |
| NFR-5 | No maintenance data, transcripts, photos, or generated reports shall persist outside the enterprise's designated cloud/on-prem boundary except in short-lived, encrypted model-inference working memory, consistent with each connector's stated data residency posture. |
| NFR-6 | Every generated field on a work order, report, or handover summary shall carry an explainability trace (source note ID, transcript timestamp range, or photo filename) retrievable by an auditor or reviewer on demand. |
| NFR-7 | All write-back actions to SAP PM, and all outbound Teams/Outlook distributions, shall generate an immutable audit log entry (who/what agent, timestamp, source record, payload hash), consistent with the SAP PM connector's audit logging pattern. |
| NFR-8 | The system shall degrade gracefully when a given input modality is unavailable (e.g., no photo submitted, or a voice memo fails to transcribe) — it shall generate the best-effort draft from the remaining available inputs and explicitly flag which fields lack supporting evidence, rather than blocking document generation entirely. |
| NFR-9 | Vision-language photo assessments and speech-to-text transcriptions shall be logged with model version and confidence score to support periodic accuracy audits and reprocessing if a model version is updated. |
| NFR-10 | The system shall support at least 50 concurrent technician submissions per plant during peak shift-change windows without exceeding the response-time targets in NFR-1/NFR-2. |

## Data Requirements

| Data | Source | Frequency | Quality Expectations |
|---|---|---|---|
| Technician notes (text/typed/OCR'd) | Technician mobile/tablet input, clipboard entries; represented in Sample Data as `technician_notes.csv` (work_order_ref, equipment_id, technician_id, note_text, captured_at) | Real-time, per repair event | Note text must be legible/transcribable; missing work_order_ref triggers a "new notification" flow rather than a failed match |
| Voice recordings | Technician mobile device or radio dictation upload | Real-time, per repair event | Audio quality sufficient for speech-to-text (ambient shop-floor noise tolerated within model's calibrated range; unintelligible segments flagged, not guessed) |
| Repair/damage photos | Technician mobile device upload, attached to note or voice submission | Real-time, per repair event, 1 or more photos per submission | JPEG/PNG, minimum resolution sufficient for vision-language part/damage identification; photos without an associated note/transcript are held for reviewer context, not auto-processed into a report |
| Equipment master data | SAP PM (Equipment Master, Functional Location objects) | Near-real-time lookup (< 2 seconds) | Must resolve technician-supplied equipment nickname/ID to a valid SAP equipment/functional location record; unresolved equipment IDs are flagged for manual selection |
| Work order / notification status | SAP PM (Maintenance Notification, Maintenance Order objects) | Near-real-time for individual lookups; hourly/nightly batch for shift-summary aggregation | Status field must be current as of shift-end aggregation to avoid stale handover summaries |
| Shift log context | Aggregated from SAP PM order status plus generated reports; represented in Sample Data as `shift_log.csv` (shift_id, plant, shift_date, shift_type, orders_completed, orders_pending, notable_events) | Once per shift (shift-end) | orders_completed/orders_pending counts must reconcile with SAP PM order status at time of generation |
| Completion detail | Technician/engineer input plus SAP PM; represented in Sample Data as `work_order_completion.csv` (order_no, equipment_id, status, completion_date, labor_hours, parts_used) | Per work order, at completion | labor_hours and parts_used should be present for any order marked Completed; missing fields are flagged rather than silently left blank in the generated report |
| SOPs / OEM manuals / historical RCA reports | SharePoint document libraries | On-demand retrieval (RAG) during report drafting | Must be current/approved versions per SharePoint sensitivity labels and version metadata |

## Stakeholders & Roles

| Role | Responsibility |
|---|---|
| Technician | Captures voice/note/photo evidence during repair; reviews and approves work-order drafts pertaining to their own work. |
| Maintenance Engineer | Reviews and approves completion reports; adjudicates photo-evidence discrepancy flags; owns documentation quality for assigned equipment. |
| Shift Supervisor / Lead | Reviews and approves the shift handover summary before distribution; escalates unresolved open items. |
| Planner | Consumes SAP PM work order data and handover summaries for scheduling; monitors data completeness KPIs. |
| Plant Manager | Accountable for overall documentation quality and compliance posture; receives handover summaries and escalations. |
| Manufacturing AI Platform Lead | Owns the assistant's technical configuration, model performance monitoring, and connector integrations. |
| IT / Security | Manages connector credentials, data residency compliance, and audit log retention. |

## Assumptions & Constraints

- Technicians carry a smartphone or tablet capable of recording voice, capturing photos, and running the Teams mobile app or equivalent submission channel; where this is not universally true, a shared kiosk/tablet fallback per work area is assumed.
- SAP PM is the plant's live system of record for work orders and notifications; this assistant does not replace SAP PM, it accelerates data entry into it.
- Ambient shop-floor noise is within the range the speech-to-text model has been calibrated/tuned for; extremely high-noise environments (e.g., directly beside an active stamping press) may require the technician to move a few steps before recording for acceptable transcription accuracy.
- Photo evidence review by the vision-language model is a consistency check, not a certification of repair quality or safety compliance — final sign-off responsibility remains with the human reviewer.
- Initial deployment scope covers two example plants (Plant A – Greenville, Plant B – Monterrey, as reflected in Sample Data) with English and Spanish language support; additional plants/languages are a Phase 2+ scaling decision (see Implementation Guide.md).
- Network connectivity on the shop floor is sufficient for near-real-time upload of voice/photo files; a local buffering/retry mechanism is assumed for intermittent connectivity zones.

## Acceptance Criteria

| Acceptance Criterion | Maps to Requirement(s) |
|---|---|
| Given a 2-minute voice memo describing a repair, the system produces a punctuated transcript with correctly recognized equipment/part terminology within 60 seconds. | FR-1, NFR-1 |
| Given a photo of a handwritten technician note, the system extracts the note text with no manual retyping required, populating the work_order_ref, equipment_id, technician_id, and note_text fields. | FR-2 |
| Given a repair photo and a note claiming "bearing replaced," the system's photo assessment correctly identifies a bearing/pump component in the image and returns a consistency confidence score; given a mismatched or blank photo, the system flags the discrepancy rather than proceeding silently. | FR-3, FR-4 |
| Given a technician note referencing equipment ID 10004521, the system retrieves the matching SAP PM equipment master record and pre-populates the functional location and description fields on the drafted notification. | FR-5, FR-6 |
| Given a completed repair with note text, transcript, and photo, the system drafts a completion report including labor hours and parts used consistent with the source inputs, with a root cause narrative traceable to specific note/transcript text. | FR-7, NFR-6 |
| No drafted work order, notification, or report is written to SAP PM, sent via Outlook, or posted to Teams without a logged human approval action tied to a specific reviewer identity. | FR-8, FR-9, NFR-7 |
| At shift end, the system generates a handover summary whose orders_completed and orders_pending counts match the current SAP PM order status for that plant and shift. | FR-10, Data Requirements (shift_log) |
| The approved handover summary is posted to the correct Teams channel and emailed to the correct Outlook distribution list within 5 minutes of supervisor approval. | FR-11 |
| Any generated field, when queried by an auditor, returns the specific source note ID, transcript timestamp, or photo filename it was derived from. | FR-12, NFR-6 |
| Generated reports and source evidence appear in the correct SharePoint library, tagged `AI-Generated`, within 15 minutes of generation. | FR-13 |
| A Spanish-language voice memo produces an accurate Spanish transcript for audit purposes and a correctly translated English structured summary for the SAP PM draft. | FR-14 |
| A second note submitted within 30 minutes referencing the same equipment ID and a similar issue is flagged as a possible duplicate before a new SAP PM notification is created. | FR-15 |
| If a submission includes only a note (no voice, no photo), the system still generates a best-effort draft and explicitly marks fields lacking photo/voice corroboration. | NFR-8 |
