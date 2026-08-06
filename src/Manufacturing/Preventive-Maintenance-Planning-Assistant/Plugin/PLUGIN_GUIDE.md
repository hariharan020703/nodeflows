# Plugin Guide: Preventive Maintenance Planner

## 1. Purpose

Preventive maintenance schedules are manually prepared today, which causes missed maintenance intervals, unnecessary servicing of low-utilization equipment, and poor technician resource utilization. The Preventive Maintenance Planner plugin generates optimized PM schedules by treating machine runtime, OEM-recommended service intervals, production plans, technician availability, and historical failure/compliance patterns as constraints in a solvable scheduling problem — combining a constraint-optimization solver (for the scheduling decision itself) with an LLM reasoning layer (for rationale explanation, checklist generation, and natural-language re-planning), while keeping Maintenance Planners and Engineers as the accountable approvers of every schedule and every write-back to SAP PM or Outlook Calendar.

## 2. Prerequisites

- SAP PM OData services enabled (`API_MAINTNOTIFICATION`, `API_MAINTENANCEORDER`, `API_EQUIPMENT`) with a dedicated service communication user (`SVC_AI_MAINT` or equivalent) provisioned per the SAP PM connector spec.
- ERP read access to production plan and plant calendar objects via the organization's ERP API layer (SAP OData/BAPI, Oracle REST API, or Dynamics 365 Web API).
- Microsoft 365 tenant with an Azure AD application registration granting `Calendars.ReadWrite` scoped to the designated shared maintenance resource calendar(s), and a Bot Framework registration installed into the specific Teams channel(s) this plugin will use.
- A provisioned SQL Database (SQL Server/PostgreSQL/Snowflake/Azure SQL) instance with a read-only service account (`svc_ai_readonly`) and a write-scoped service account (`svc_ai_writer`) limited to staging/audit schemas.
- SharePoint document library access (read-only service credential) to the OEM manual and plant SOP corpus, indexed for retrieval-augmented generation.
- Model access to the organization's approved LLM deployment (Azure OpenAI / Claude on Bedrock / on-prem LLM gateway) with sufficient throughput to support the performance targets in `Technical Design.md`'s Scalability & Performance Targets section (NFR-1).

## 3. Installation Steps

1. **Add the marketplace (or local path) that hosts this plugin:** `/plugin marketplace add <org>/manufacturing-repository` (or a local path during development against this repository).
2. **Install the plugin:** `/plugin install preventive-maintenance-planner@<marketplace-name>`. Claude Code/Cowork reads the manifest at `Plugin/.claude-plugin/plugin.json`.
3. **Provide the MCP connector credentials.** On install, the platform reads `Plugin/.mcp.json` and registers the five connector servers (`sap-pm`, `erp`, `outlook-calendar`, `microsoft-teams`, `sql-database`); it will prompt for the required environment variables referenced there — `SAP_PM_MCP_TOKEN`, `ERP_MCP_TOKEN`, `OUTLOOK_CALENDAR_MCP_TOKEN`, `MS_TEAMS_MCP_TOKEN`, and `SQL_DATABASE_MCP_TOKEN` — each an OAuth bearer token (or equivalent) scoped per that connector's `SPEC.md` authorization model. Set these as secrets in the environment before or during install; never hardcode them.
4. **Confirm the skills load.** The plugin manifest's `skills` field points at `../Skills`; the platform loads each `Skills/<skill-name>/SKILL.md` (Maintenance Scheduler, Resource Planner, Checklist Generator, Calendar Optimizer) into its skill registry automatically — no separate registration step is required.
5. Index the SharePoint OEM manual and plant SOP corpus for retrieval, tagging each document with manufacturer/model metadata to support the Checklist Generator skill's model/serial disambiguation. (This retrieval corpus sits outside the MCP connectors declared in `.mcp.json` and is configured directly against the organization's RAG/search infrastructure.)
6. Configure the Teams bot's approval-gate adaptive card templates and install the bot into the designated planning channel(s) (e.g., `Plant A - Maintenance Planning Channel`), consistent with the `microsoft-teams` connector's tool manifest (`Connectors/microsoft-teams/tools.json`).
7. Activate the plugin in **shadow mode** (schedule generation and rationale only; no write-back) for the pilot line/plant, per the Implementation Guide's Pilot phase — i.e., do not invoke the write tools in `sap_pm` (`sap_pm_create_planned_order`) or `outlook-calendar` (`outlook_create_event`) until sign-off.
8. After shadow-mode sign-off, enable the write-capable MCP tools for the pilot scope (per the human-approval gates documented in each connector's `tools.json` and in Business Requirements NFR-5), then expand line-by-line/plant-by-plant.

## 4. Configuration Reference

| Parameter | Description | Default |
|---|---|---|
| `horizon_weeks` | Rolling scheduling horizon length | 13 weeks |
| `interval_due_threshold_pct` | Interval utilization % at which an asset is flagged "due within horizon" | 85% |
| `interval_overdue_threshold_pct` | Interval utilization % at which an asset is treated as a hard-constraint overdue item | 100% |
| `solver_time_budget_seconds` | Max CP-SAT solve time before falling back to heuristic solver | 180 seconds |
| `heuristic_fallback_task_threshold` | Task count above which the heuristic/genetic solver is used instead of CP-SAT | 800 tasks |
| `workload_smoothing_cap_pct` | Weekly technician-hour utilization above which the workload-smoothing soft constraint is penalized | 80% |
| `reschedule_alternative_attempts` | Number of alternative slots the Calendar Optimizer tries before escalating a calendar conflict | 3 |
| `erp_staleness_guard_hours` | Age of cached ERP production-plan data beyond which automatic publication is blocked | 48 hours |
| `nl_intent_confidence_threshold` | Minimum confidence for the LLM to act on a natural-language re-planning request without a clarifying question | 0.75 |
| `teams_approval_channel` | Teams channel the approval-gate adaptive cards are posted to | `Plant A - Maintenance Planning Channel` (per-plant configurable) |
| `escalation_recipients` | Role(s) notified for Critical-asset interval-breach escalations | Maintenance Engineer, Plant Maintenance Manager |

## 5. Validation / Smoke Test

Using the files in `Sample Data/`:

1. Load `equipment_runtime.csv`, `technician_availability.csv`, and `pm_schedule_history.csv` into the sandbox SQL Database staging tables.
2. Trigger an on-demand schedule generation for `LINE1` covering a 4-week test horizon starting `2026-08-04`.
3. **Expected result:** the Maintenance Scheduler flags `EQ-10088` (Centrifugal Pump P-101, interval_utilization ≈ 97% at last recorded runtime) as due-within-horizon, and the Resource Planner assigns a technician holding `Mechanical` or `Lubrication & Reliability` certification who is available per `technician_availability.csv`, with the schedule respecting any `LINE1` production windows configured in the sandbox ERP test fixture.
4. Confirm the Checklist Generator returns a sequenced checklist for the assigned task with at least one source citation, and confirm the Calendar Optimizer posts a Teams adaptive card summarizing the proposed schedule to the sandbox planning channel.
5. Approve the card in sandbox and confirm an Outlook Calendar event is created and a SAP PM sandbox planned order is created in "Planned, Unreleased" status.
6. Simulate a disruption (extend a `LINE1` production window in the sandbox ERP fixture) and confirm the Calendar Optimizer re-optimizes only the impacted task(s) and posts a re-optimization diff card, leaving all other confirmed tasks unchanged.

The plugin is considered validated for promotion when all six steps complete without a hard-constraint violation and without any write-back occurring prior to a logged approval action.

## 6. Rollback Plan

- **Immediate disable:** run `/plugin uninstall preventive-maintenance-planner` (or disable it in the marketplace UI); this halts all new schedule generation and re-optimization immediately while leaving already-published Outlook Calendar events and SAP PM planned orders intact (they revert to being managed manually by the Planner going forward).
- **Selective scope rollback:** disable the plugin for a specific line/plant by removing that scope from whatever platform-level schedule/cron configuration invokes the assistant for that line, without uninstalling the plugin tenant-wide, allowing other pilot lines to continue operating.
- **Write-back rollback:** if a specific write-back action is found to be defective, revoke or rotate the corresponding connector's MCP token (e.g., `SAP_PM_MCP_TOKEN` or `OUTLOOK_CALENDAR_MCP_TOKEN` in `Plugin/.mcp.json`) so the write tools in that connector's `tools.json` fail closed, while leaving the other connectors' read-only tools and rationale generation active.
- **Data rollback:** because all write-backs are logged with payload references in the SQL Database audit tables, any erroneous SAP PM order or Outlook Calendar event created before disablement can be identified via audit query and manually reversed by the Planner/Engineer using standard SAP PM (order cancellation) and Outlook (event deletion) procedures.
- **Communication:** on any rollback, notify the affected plant's Maintenance Planner and Plant Manager via the same Teams channel used for approvals, stating scope and expected duration of the rollback.

## 7. Reusability Notes

The constraint-based scheduling and calendar-publishing architecture in this plugin is designed to generalize beyond Maintenance:
- **Quality** can reuse the Maintenance Scheduler's constraint pattern (asset/audit interval + production-window + resource-capacity constraints) to schedule recurring calibration and compliance audits, and reuse the Resource Planner to assign certified auditors.
- **Production** can reuse the Calendar Optimizer's incremental "warm restart" re-optimization and natural-language re-planning pattern for changeover and tooling-swap scheduling around shifting demand plans.
- **EHS** can reuse the Checklist Generator's OEM/regulatory-manual RAG-and-overlay pattern to generate statutory inspection checklists for pressure vessels and lifting equipment, with the same safety/permit-flagging guardrails.
- The Outlook Calendar and Microsoft Teams connector integration (free/busy checking, adaptive-card approval gates) is entirely domain-agnostic and can be reused unmodified by any department needing conversational scheduling with human-in-the-loop approval.
- Departments adopting this plugin's pattern should re-parameterize only the constraint definitions (interval source, blackout source, certification taxonomy) and the RAG document corpus — the solver, orchestration, and connector architecture do not need to change.
