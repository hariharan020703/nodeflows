# Preventive Maintenance Planning Assistant

**Turning static PM calendars into a living, constraint-aware schedule that adapts as production, technicians, and equipment condition change.**

## Business Problem

Preventive maintenance (PM) schedules in most plants are still built the way they were twenty years ago: a planner works from a spreadsheet or the SAP PM maintenance-plan due list, manually cross-checks it against a production plan they hold in their head or in a separate document, and manually calls around to see which technicians are free. The result is a schedule that is stale the moment it is published and that nobody re-optimizes when reality changes.

The cost pattern is well documented industry-wide (illustrative benchmarks, not client-specific figures):

- Plants relying on manually built PM schedules typically report **schedule compliance (PM tasks completed within their planned window) in the 55–70% range**, versus **85–95%** for plants using optimization-assisted scheduling (illustrative range from published reliability/CMMS benchmarking studies).
- Missed or delayed PM intervals are a leading contributor to unplanned breakdowns — industry reliability studies commonly attribute **20–30% of unplanned downtime events** to overdue or skipped preventive maintenance.
- Over-conservative, non-optimized PM calendars (servicing "on schedule" regardless of actual runtime) typically drive **10–20% unnecessary servicing cost** — labor and parts spent maintaining equipment that has not yet accrued enough runtime to need it.
- Manual PM planning is a significant time sink for maintenance planners and engineers, typically consuming **15–25% of a planner's working week** on schedule construction and re-work alone (illustrative range from MRO workforce studies), time that would otherwise go to reliability improvement work.

These are directional, industry-typical ranges intended to frame the scale of the opportunity — actual figures should be validated against plant-specific schedule-compliance and CMMS data during the Discovery phase (see Implementation Guide.md).

## AI Goal

Generate optimized preventive maintenance schedules by treating machine runtime and OEM-recommended service intervals, production plan commitments, technician availability, and historical failure/compliance patterns as constraints in a solvable scheduling problem — producing a schedule that keeps every asset within its OEM interval, respects production windows, matches the right certified technician to the right task, and explains its own reasoning in plain language to the planners and engineers who must trust and approve it.

## Solution Overview

The Preventive Maintenance Planning Assistant is a constraint-based scheduling engine wrapped in an LLM-orchestrated planning copilot. At its core, the Maintenance Scheduler skill formulates PM scheduling as a constraint-satisfaction/optimization problem: equipment due dates (derived from SAP PM equipment master and maintenance-plan data, cross-referenced with live runtime hours), ERP production plan windows, plant shutdown calendars, and technician certification/availability are encoded as hard and soft constraints and solved with a constraint-programming (CP-SAT-style) or heuristic scheduling algorithm. The Resource Planner skill then matches each scheduled task to a specific, qualified, available technician using Outlook Calendar free/busy data, and the Checklist Generator skill assembles the exact OEM- and SOP-grounded task checklist for that technician to follow.

An LLM reasoning layer sits above the solver, not in place of it: it does not decide when a task should happen — the optimizer does — but it explains why (translating constraint traces into plain-language rationale), drafts and grounds checklists in retrieved OEM/SOP documentation, and parses natural-language re-planning requests from planners ("push everything on Line 3 to next month because of the freeze") into structured constraint-model modifications that the Calendar Optimizer skill then re-solves and publishes. This division of labor — deterministic optimization for the scheduling decision, LLM for explanation, retrieval, and natural-language interaction — is deliberate: it keeps the actual scheduling decisions auditable and reproducible while still giving planners a conversational interface.

Every schedule the assistant proposes, and every re-optimization triggered by a disruption (a production freeze, a technician absence, an equipment breakdown), is delivered as a reviewable Teams adaptive card or SAP PM planned/unreleased order before it becomes a live commitment — planners remain the accountable decision-makers; the assistant compresses the analysis time from hours to minutes.

## Key Capabilities

- Constraint-based optimization of the full-horizon PM schedule (typically next-quarter) across all assets on a line or plant, jointly respecting OEM intervals, production windows, plant shutdown calendars, and technician capacity.
- Automatic due-list computation from live runtime data, replacing static calendar-based scheduling with actual-usage-based scheduling.
- Certification-aware, workload-balanced technician assignment with a resource-gap report when no qualified technician is available in the window.
- Auto-generated, OEM- and SOP-grounded task checklists with safety/permit flags and reliability-driven "do not skip" callouts.
- Incremental, "warm restart" re-optimization when disruptions occur, minimizing unnecessary churn to already-confirmed technician assignments.
- Natural-language re-planning: planners can request schedule changes in plain English via Teams, with a reviewable diff before any write-back.
- Plain-language rationale for every scheduled date, citing the specific constraint (production window, interval deadline, technician availability) that determined it.
- Full audit trail of every AI-proposed schedule, every human approval/override, and every calendar/SAP PM write-back.

Skills and Connectors below now follow Claude's real Agent Skills and MCP connector formats — each skill is a loadable `SKILL.md` folder and each connector pairs its narrative spec with a client-side MCP server declaration and tool manifest, rather than the flat, invented-schema markdown files used previously.

## Skills Used

| Skill | Purpose | Path |
|---|---|---|
| Maintenance Scheduler | Solves the core constraint-optimization problem to produce a candidate PM schedule from runtime, OEM intervals, production plan, and history. | `Skills/maintenance-scheduler/SKILL.md` |
| Resource Planner | Matches each scheduled task to a specific certified, available technician, balancing workload across the roster. | `Skills/resource-planner/SKILL.md` |
| Checklist Generator | Assembles the OEM- and SOP-grounded, safety-flagged task checklist for each scheduled PM visit. | `Skills/checklist-generator/SKILL.md` |
| Calendar Optimizer | Publishes the schedule to Outlook Calendar/Teams and incrementally re-optimizes it when disruptions or natural-language re-planning requests occur. | `Skills/calendar-optimizer/SKILL.md` |

## Connectors Used

| Connector | Purpose | Path |
|---|---|---|
| SAP PM | System of record for equipment master data, maintenance plan intervals, and maintenance orders; destination for scheduled work-order write-back. | `Connectors/sap-pm/` |
| ERP | Source of production plan windows and plant shutdown calendars that constrain feasible PM scheduling dates. | `Connectors/erp/` |
| Outlook Calendar | Source of technician free/busy availability; destination for published PM schedule events. | `Connectors/outlook-calendar/` |
| Microsoft Teams | Delivery of schedule-approval adaptive cards, re-optimization notifications, and the natural-language re-planning chat interface. | `Connectors/microsoft-teams/` |
| SQL Database | Analytics/staging layer consolidating runtime, technician availability, and PM schedule history for the scheduling and resource-planning skills. | `Connectors/sql-database/` |

## Plugin Name

**Preventive Maintenance Planner** (`name: preventive-maintenance-planner`, manifest at `Plugin/.claude-plugin/plugin.json`)

## Folder Contents Index

| Location | Contents |
|---|---|
| `README.md` | This document — use case overview, capabilities, skills, connectors. |
| `Business Process.md` | Current-state vs. future-state PM planning process, Mermaid process flow, RACI, KPIs. |
| `Business Requirements.md` | Objective, scope, numbered functional/non-functional requirements, data requirements, acceptance criteria. |
| `Technical Design.md` | Architecture, Mermaid diagram, constraint-optimization + LLM model approach, skill design, security/governance. |
| `Implementation Guide.md` | Prerequisites, phased rollout plan, environment setup, testing strategy, change management, go-live checklist. |
| `Prompt Library.md` | Production-ready prompts used by the skills and as planner-facing quick actions, with governance notes. |
| `Sample Data/` | `equipment_runtime.csv`, `technician_availability.csv`, `pm_schedule_history.csv` — realistic, internally consistent test data. |
| `Skills/` | One real Agent Skill folder per skill (`Skills/<skill-name>/SKILL.md`, plus `REFERENCE.md` for reusability notes) — Maintenance Scheduler, Resource Planner, Checklist Generator, Calendar Optimizer. |
| `Connectors/` | One folder per connector (`Connectors/<connector-name>/`), each with `SPEC.md` (narrative spec), `mcp-server.json` (client-side MCP declaration), and `tools.json` (MCP tool manifest). |
| `Plugin/` | `.claude-plugin/plugin.json` (real plugin manifest), `.mcp.json` (aggregated MCP server declarations), and `PLUGIN_GUIDE.md` (installation, configuration, validation, rollback, reusability). |

## Ownership / Maintainer

| Role | Responsibility |
|---|---|
| Business Owner | Plant Maintenance Manager |
| Technical Owner | Manufacturing AI Platform Lead |
