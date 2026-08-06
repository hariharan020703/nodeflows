# Maintenance Documentation & Work Order Assistant

**Turning a technician's shouted-over-the-noise voice note into a submitted SAP work order — without anyone retyping a word.**

## Business Problem

Maintenance engineers and technicians spend a disproportionate share of the workday on paperwork rather than wrenches: writing up completed repairs, creating and updating SAP PM notifications and work orders, documenting root cause and parts consumption for compliance and warranty purposes, and preparing shift handover summaries so the next crew isn't starting cold. Most of this documentation is drafted from memory, hand-written notes, or short voice memos recorded between jobs, then manually re-typed into SAP, email, and shift-log spreadsheets — often hours after the actual work, when detail has already faded.

The cost pattern is well documented industry-wide (illustrative benchmarks, not client-specific figures):

- Frontline maintenance technicians and engineers typically spend **1–2 hours per 8-hour shift** on documentation and administrative work-order tasks — commonly cited as **15–25% of a technician's paid time** in maintenance workforce studies (industry MRO/CMMS adoption surveys).
- Work order and notification data entered manually into CMMS/EAM systems shows materially higher rates of missing fields, inconsistent failure-code classification, and delayed closure — studies of EAM data quality frequently cite **20–30% of closed work orders** missing key structured fields (labor hours, parts, failure mode) needed for reliable MTBF/MTTR analytics.
- Shift handover quality is repeatedly identified as a top contributor to lost time and repeat visits in multi-shift operations; incomplete or inconsistent handovers are estimated to contribute to **10–15% of avoidable follow-up trips** in benchmarking studies of shift-based maintenance organizations.
- Delayed or incomplete documentation compounds warranty, insurance, and regulatory audit risk, since claims and audits typically require a defensible, timestamped record connecting labor, parts, and root cause to a specific asset and work order.

These are directional, industry-typical ranges intended to frame the scale of the opportunity — actual figures should be validated against plant-specific CMMS closure-time and data-completeness metrics during the Discovery phase (see Implementation Guide.md).

## AI Goal

Automatically generate maintenance reports, SAP PM work orders, shift handover summaries, and repair completion documents directly from the raw inputs technicians already produce in the course of doing the work — hand-written or typed notes, short voice recordings captured on a phone or radio, and photos of the repair or damage — so that documentation becomes a byproduct of the work rather than a second job performed after it.

## Solution Overview

The Maintenance Documentation & Work Order Assistant is a multimodal document-generation copilot that sits between the raw, unstructured inputs technicians naturally create — voice memos, handwritten or typed shorthand notes, and repair/damage photos — and the systems maintenance organizations depend on for governance and continuity: SAP PM (system of record for work orders and notifications), SharePoint (document and photo evidence repository), Microsoft Teams (technician and shift-team communication), and Outlook (formal report and handover distribution).

When a technician finishes a task, the assistant transcribes any voice recording (Voice-to-Report skill), reads and normalizes handwritten or shorthand notes via OCR, and analyzes accompanying photos with a vision-language model to verify that the claimed repair is visually consistent with the evidence (e.g., a replaced bearing photographed next to the pump, a cracked coupling insert photographed before removal). These multimodal inputs are fused by an LLM document-generation layer that drafts a structured SAP PM work order or completion report (Work Order Generator, Report Writer), citing the specific technician note, timestamp, and photo it drew each field from. At shift end, the same pipeline aggregates the day's completed and pending work orders and notable events into a structured handover summary (Shift Summary Generator) delivered to the incoming shift via Teams and Outlook.

Every generated document — work order, completion report, or handover summary — is presented to a human (technician, maintenance engineer, or shift supervisor) for review and edit before it is written back to SAP PM or distributed, so the assistant compresses the time to produce accurate documentation without removing the accountable human sign-off that governs system-of-record data and, where applicable, warranty and compliance records.

## Key Capabilities

- Speech-to-text transcription of technician voice memos (radio, phone, or dictation app) into clean, punctuated text, with maintenance-domain vocabulary correction (equipment nicknames, part numbers, trade jargon).
- OCR and normalization of handwritten or shorthand paper notes and clipboard entries into structured text fields.
- Vision-language photo analysis that verifies claimed repair evidence (before/after damage state, parts installed, completed vs. incomplete work) and flags mismatches for human review rather than silently accepting unverified claims.
- LLM-drafted SAP PM work orders and maintenance notifications, pre-populated with equipment, functional location, failure mode, priority, and short/long text, ready for technician or planner review.
- LLM-drafted maintenance completion reports and repair completion certificates with labor hours, parts consumed, and root cause narrative, traceable back to the source note/voice/photo.
- Automated shift handover summaries aggregating completed orders, pending orders, and notable events, distributed via Teams and Outlook before shift change.
- Full source traceability: every generated field links back to the specific technician note, transcript segment, or photo it was derived from, supporting audit and warranty defense.
- Human-in-the-loop approval gate before any write-back to SAP PM or any external distribution of a report.

## Skills Used

| Skill | Purpose | Location |
|---|---|---|
| Report Writer | Drafts structured maintenance completion reports and repair narratives from technician notes, transcripts, and photo evidence. | `Skills/report-writer/SKILL.md` |
| Voice-to-Report | Transcribes technician voice recordings into clean text and structures them into a repair-note format ready for downstream use. | `Skills/voice-to-report/SKILL.md` |
| Work Order Generator | Drafts SAP PM-formatted work orders and notifications (equipment, functional location, failure mode, priority, text) from technician input. | `Skills/work-order-generator/SKILL.md` |
| Shift Summary Generator | Aggregates the shift's completed and pending work orders and notable events into a structured handover summary. | `Skills/shift-summary-generator/SKILL.md` |

## Connectors Used

| Connector | Purpose | Location |
|---|---|---|
| SAP PM | System of record for equipment master data, notifications, work orders, and completion confirmations; primary write-back target for generated documentation. | `Connectors/sap-pm/` (`SPEC.md`, `mcp-server.json`, `tools.json`) |
| SharePoint | Repository for SOPs/OEM manuals used for grounding, and storage/retrieval of repair photo and voice-recording attachments and generated report archives. | `Connectors/sharepoint/` (`SPEC.md`, `mcp-server.json`, `tools.json`) |
| Microsoft Teams | Delivery of draft documents for technician/engineer review-and-approve, and distribution of shift handover summaries to shift channels. | `Connectors/microsoft-teams/` (`SPEC.md`, `mcp-server.json`, `tools.json`) |
| Outlook | Email distribution of finalized completion reports, shift summaries, and escalations to engineers, planners, and plant management. | `Connectors/outlook/` (`SPEC.md`, `mcp-server.json`, `tools.json`) |

## Plugin Name

**Maintenance Documentation Assistant** (`name: maintenance-documentation-assistant`, manifest at `Plugin/.claude-plugin/plugin.json`)

Skills and Connectors in this use case now follow Claude's real Agent Skills and MCP formats (see `Shared-Library/Templates/SKILL-MD-SPEC.md` and `MCP-CONNECTOR-SPEC.md`) rather than the earlier invented, non-standard schema.

## Folder Contents Index

| Location | Contents |
|---|---|
| `README.md` | This document — use case overview, capabilities, skills, connectors. |
| `Business Process.md` | Current-state vs. future-state documentation workflow, Mermaid process flow, RACI, KPIs. |
| `Business Requirements.md` | Objective, scope, numbered functional/non-functional requirements, data requirements, acceptance criteria. |
| `Technical Design.md` | Architecture, Mermaid diagram, multimodal AI approach (speech-to-text + vision-language + OCR + LLM generation), skill design, security/governance. |
| `Implementation Guide.md` | Prerequisites, phased rollout plan, environment setup, testing strategy, change management, go-live checklist. |
| `Prompt Library.md` | Production-ready prompts used by the skills and as user-facing quick actions, with governance notes. |
| `Sample Data/` | `technician_notes.csv`, `shift_log.csv`, `work_order_completion.csv` — realistic, internally consistent test data. |
| `Skills/` | Four real Agent Skill folders (`report-writer/`, `voice-to-report/`, `work-order-generator/`, `shift-summary-generator/`), each a `SKILL.md` with YAML frontmatter plus a `REFERENCE.md` for reusability notes, per `SKILL-MD-SPEC.md`. |
| `Connectors/` | Four connector folders (`sap-pm/`, `outlook/`, `microsoft-teams/`, `sharepoint/`), each with a narrative `SPEC.md`, a client-side `mcp-server.json` declaration, and an MCP `tools.json` tool manifest, per `MCP-CONNECTOR-SPEC.md`. |
| `Plugin/` | `.claude-plugin/plugin.json` (real plugin manifest), `.mcp.json` (aggregated MCP server registrations), and `PLUGIN_GUIDE.md` (installation, configuration, validation, rollback, reusability), per `CLAUDE-PLUGIN-SPEC.md`. |

## Ownership / Maintainer

| Role | Responsibility |
|---|---|
| Business Owner | Plant Maintenance Manager |
| Technical Owner | Manufacturing AI Platform Lead |
