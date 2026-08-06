# Predictive Maintenance Assistant

**Turning equipment telemetry into foresight — catching failures days before they happen, not minutes after.**

## Business Problem

Maintenance organizations across discrete and process manufacturing remain predominantly reactive: work begins after an alarm has already fired, a bearing has already seized, or a line has already stopped. Technicians triage breakdown notifications under time pressure, root cause is diagnosed after the fact, and repairs are executed as emergency work rather than planned work.

The cost pattern is well documented industry-wide (illustrative benchmarks, not client-specific figures):

- Unplanned downtime is estimated to cost discrete manufacturers on the order of **$50,000–$260,000 per hour** depending on industry and line criticality (various industry surveys, e.g., Aberdeen Group, Deloitte manufacturing studies).
- Reactive/breakdown maintenance typically costs **3–9x more** per repair event than the same repair performed as planned, scheduled work (industry MRO benchmarking studies).
- Plants operating primarily in reactive mode typically report **unplanned downtime consuming 15–25% of total available production time**, versus **under 5%** for plants with mature predictive maintenance programs (illustrative range from published OEE/reliability benchmarking studies).
- Emergency parts sourcing and overtime labor associated with unplanned failures typically add **20–35% cost premiums** versus planned procurement and scheduled labor.

These are directional, industry-typical ranges intended to frame the scale of the opportunity — actual figures should be validated against plant-specific OEE, MTTR, and MTBF data during the Discovery phase (see Implementation Guide.md).

## AI Goal

Continuously analyze machine health signals — vibration, temperature, current draw, runtime/cycle counters, digital alarm states, and historical maintenance records — to detect early degradation patterns and predict component and equipment failures before they occur, with enough lead time and enough specificity (equipment, likely failure mode, confidence, recommended action) for maintenance teams to convert emergency repairs into planned work.

## Solution Overview

The Predictive Maintenance Assistant is an AI copilot that sits between the plant's OT telemetry (OPC-UA/PLC), its analytics staging layer (SQL Database), its system of record for maintenance (SAP PM), and the channels maintenance teams already work in (Microsoft Teams, Outlook, SharePoint). It continuously ingests sensor readings and alarm events, applies a layered analytics approach — statistical control-limit and isolation-forest anomaly detection for early-warning flags, combined with gradient-boosted survival models and LSTM/transformer-based remaining-useful-life (RUL) estimators for quantified failure-risk scoring — and hands the resulting signals to an LLM orchestration layer that reasons over them in the context of the equipment's maintenance history and applicable SOPs.

When a risk signal crosses a materiality threshold, the assistant does not just alert — it diagnoses. It correlates the anomaly against historical fault signatures (Fault Diagnosis skill), reasons about probable root cause using RCA frameworks retrieved from SharePoint-hosted RCA archives (Root Cause Analysis skill), proposes a maintenance action window and resourcing plan against existing PM schedules and spare-parts constraints (Maintenance Planner skill), retrieves the exact SOP section a technician needs (SOP Retrieval skill), and drafts the SAP PM notification and closing report text a planner or technician would otherwise write by hand (Maintenance Report Writer skill).

Every output that changes a system of record — creating a notification, scheduling an order, sending an escalation — passes through a human-in-the-loop approval gate delivered via Teams adaptive cards or Outlook, so the assistant accelerates and informs decisions without removing accountable humans from safety- or cost-relevant actions.

## Key Capabilities

- Continuous multivariate anomaly detection across vibration, temperature, current, and pressure signals per equipment, with statistically calibrated alarm thresholds (not fixed hard limits).
- Remaining-useful-life (RUL) estimation for critical rotating assets (pumps, motors, gearboxes, bearings) with a stated confidence interval and predicted failure window.
- LLM-orchestrated fault diagnosis that fuses live telemetry, alarm history, and prior maintenance records into a ranked list of probable failure modes.
- Root cause analysis grounded in historical RCA reports and OEM documentation via retrieval-augmented generation (RAG).
- Maintenance action planning that respects existing PM calendars, crew availability, and spare-parts lead times.
- SOP retrieval that surfaces the exact procedure/section relevant to the diagnosed fault, not just a document link.
- Auto-drafted SAP PM notifications, work order text, and closing maintenance reports, subject to human review before write-back.
- Delivery of alerts and decision options via Microsoft Teams (adaptive cards) and Outlook, with full audit logging of every recommendation and human decision.

## Skills Used

Skills below follow Claude's real Agent Skills format (a folder per skill containing `SKILL.md` with YAML frontmatter) — see `Shared-Library/Templates/SKILL-MD-SPEC.md`.

| Skill | Purpose | Location |
|---|---|---|
| Fault Diagnosis | Correlates live sensor anomalies and alarms against historical fault signatures to produce a ranked list of probable failure modes with confidence scores. | `Skills/fault-diagnosis/SKILL.md` |
| Root Cause Analysis | Performs structured root-cause reasoning (5-Why / fishbone-style) grounded in historical RCA reports and OEM documentation retrieved via RAG. | `Skills/root-cause-analysis/SKILL.md` |
| Maintenance Planner | Converts a diagnosed risk into a concrete, resource- and parts-aware maintenance action plan aligned to existing PM schedules. | `Skills/maintenance-planner/SKILL.md` |
| SOP Retrieval | Retrieves the precise SOP/checklist section relevant to a diagnosed fault or planned maintenance task from SharePoint. | `Skills/sop-retrieval/SKILL.md` |
| Maintenance Report Writer | Drafts SAP PM notification text, work order descriptions, and post-completion maintenance reports for human review and submission. | `Skills/maintenance-report-writer/SKILL.md` |

## Connectors Used

Connectors below follow Claude's real MCP connector format — each folder pairs the narrative spec with a client-side MCP server declaration (`mcp-server.json`) and an MCP tool manifest (`tools.json`), per `Shared-Library/Templates/MCP-CONNECTOR-SPEC.md`.

| Connector | Purpose | Location |
|---|---|---|
| SAP PM | System of record for equipment master data, maintenance notifications, work orders, and breakdown history; source and destination for write-back. | `Connectors/sap-pm/` |
| SQL Database | Analytics/staging layer consolidating sensor, alarm, and maintenance history data for model inference and feature engineering. | `Connectors/sql-database/` |
| OPC-UA / PLC | Live and short-horizon historical shop-floor telemetry: vibration, temperature, pressure, current draw, digital alarms, runtime counters. | `Connectors/opc-ua-plc/` |
| SharePoint | Repository for SOPs, OEM manuals, and historical RCA reports used for grounded retrieval (RAG). | `Connectors/sharepoint/` |
| Microsoft Teams | Delivery of alerts, RUL briefings, and interactive approval/escalation workflows to shift teams and engineers. | `Connectors/microsoft-teams/` |
| Outlook | Email delivery of maintenance reports, escalations, and shift summaries; optional ingestion of vendor correspondence. | `Connectors/outlook/` |

## Plugin Name

**Maintenance Copilot** (`name: maintenance-copilot`, manifest at `Plugin/.claude-plugin/plugin.json`)

## Folder Contents Index

| Location | Contents |
|---|---|
| `README.md` | This document — use case overview, capabilities, skills, connectors. |
| `Business Process.md` | Current-state vs. future-state maintenance process, Mermaid process flow, RACI, KPIs. |
| `Business Requirements.md` | Objective, scope, numbered functional/non-functional requirements, data requirements, acceptance criteria. |
| `Technical Design.md` | Architecture, Mermaid diagram, AI/model approach (anomaly detection + RUL + LLM/RAG), skill design, security/governance. |
| `Implementation Guide.md` | Prerequisites, phased rollout plan, environment setup, testing strategy, change management, go-live checklist. |
| `Prompt Library.md` | Production-ready prompts used by the skills and as user-facing quick actions, with governance notes. |
| `Sample Data/` | `sensor_readings.csv`, `alarm_log.csv`, `maintenance_history.csv` — realistic, internally consistent test data. |
| `Skills/` | One real Agent Skill folder per skill (`<skill-name>/SKILL.md` + `REFERENCE.md`) — Fault Diagnosis, Root Cause Analysis, Maintenance Planner, SOP Retrieval, Maintenance Report Writer. |
| `Connectors/` | One folder per connector (`<connector-name>/SPEC.md` + `mcp-server.json` + `tools.json`) — the narrative spec adapted from the Shared-Library canonical specs, paired with real MCP client declaration and tool manifest artifacts. |
| `Plugin/` | `.claude-plugin/plugin.json` (real Claude Code/Cowork plugin manifest), `.mcp.json` (aggregated MCP server declarations), and `PLUGIN_GUIDE.md` (installation, configuration, validation, rollback, reusability). |

## Ownership / Maintainer

| Role | Responsibility |
|---|---|
| Business Owner | Plant Maintenance Manager |
| Technical Owner | Manufacturing AI Platform Lead |
