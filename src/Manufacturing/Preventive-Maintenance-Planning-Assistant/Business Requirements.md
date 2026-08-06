# Business Requirements: Preventive Maintenance Planning Assistant

## Objective

Deliver an AI-assisted planning capability that generates optimized preventive maintenance schedules — jointly respecting machine runtime and OEM service intervals, production plan commitments, technician availability, and historical schedule-compliance patterns — so that PM schedule compliance rises materially above manual-planning baselines, unnecessary servicing is reduced, and Maintenance Planners spend materially less time on manual schedule construction and rework, while every schedule and re-optimization remains subject to human review and approval before it becomes a live shop-floor commitment.

## In-Scope

- Generation of rolling-horizon (default: 13-week) PM schedules for a specified plant, line, or asset class, driven by OEM service intervals and live/near-real-time equipment runtime data.
- Incorporation of ERP production plan windows and plant shutdown/holiday calendars as hard scheduling constraints.
- Technician-to-task assignment based on certification match, shift, and calendar free/busy availability, with workload balancing.
- Auto-generation of OEM- and SOP-grounded task checklists, including safety/permit flags and reliability-driven callouts.
- Publishing of approved schedules to Outlook Calendar (shared maintenance resource calendar and technician calendars) and creation of corresponding SAP PM planned maintenance orders (held unreleased pending Planner release).
- Incremental re-optimization of the schedule in response to disruption events (production plan changes, technician leave, breakdown notifications) and to natural-language re-planning requests submitted via Microsoft Teams.
- Plain-language rationale generation for every scheduled date and every re-optimization decision.
- Schedule-compliance and resource-utilization KPI reporting.

## Out-of-Scope

- Corrective/breakdown work order creation and root-cause diagnosis (covered by the Breakdown Root-Cause Analysis Copilot use case).
- Predictive failure detection from live sensor telemetry (covered by the Predictive Maintenance Assistant use case).
- Spare parts inventory optimization and procurement (covered by the Spare Parts Intelligence Assistant use case).
- Any write-back to ERP financial/cost-center postings.
- Automatic release of SAP PM work orders to the shop floor without human release action.
- Long-term (multi-year) capital maintenance/overhaul strategic planning — this use case addresses recurring, interval-based PM only.

## Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | The system shall compute, for each asset in scope, an `interval_utilization` value derived from current `run_hours_total` and `oem_service_interval_hours`, refreshed at least daily. |
| FR-2 | The system shall generate a candidate PM schedule for a specified horizon that assigns a proposed date to every asset whose `interval_utilization` is projected to reach or exceed 85% within that horizon. |
| FR-3 | The system shall never propose a PM task date that falls within an ERP-sourced production plan window committing the asset's line to production, unless the task type is explicitly designated as permissible during production (e.g., inspection-only tasks). |
| FR-4 | The system shall never propose a PM task date that falls on a plant shutdown/holiday day marked as unavailable in the Plant Calendar, unless the task is specifically intended to leverage a shutdown window. |
| FR-5 | The system shall assign each scheduled task to a specific technician holding the required certification, verified available via Outlook Calendar free/busy for the proposed date/time. |
| FR-6 | The system shall produce a resource-gap report listing any task that cannot be staffed with a qualified, available technician within the horizon. |
| FR-7 | The system shall balance technician workload such that no technician's projected weekly scheduled hours exceed their `weekly_hours_capacity` without an explicit overtime flag. |
| FR-8 | The system shall generate a task-specific checklist for every scheduled PM task, grounded in the applicable OEM manual section and plant SOP overlays, with source citations for each step. |
| FR-9 | The system shall flag any checklist step correlated with prior failure notifications for that asset/asset class as "Do Not Skip," citing the correlating historical record(s). |
| FR-10 | The system shall attach a plain-language rationale to every scheduled task explaining which constraint(s) determined its date. |
| FR-11 | The system shall require explicit human (Planner or Maintenance Engineer) approval before publishing any schedule to Outlook Calendar or creating a SAP PM planned order. |
| FR-12 | The system shall detect specified disruption events (ERP production plan change, technician leave/absence, SAP PM breakdown notification affecting a scheduled asset) and automatically identify all PM tasks impacted. |
| FR-13 | The system shall re-optimize only the impacted subset of tasks upon a disruption event, leaving unaffected, already-confirmed tasks unchanged ("warm restart"). |
| FR-14 | The system shall accept natural-language re-planning requests via Microsoft Teams, translate them into structured constraint-model modifications, and present a reviewable diff before any write-back. |
| FR-15 | The system shall never automatically schedule a Critical-criticality asset past its OEM interval; any scenario where this cannot be avoided within the horizon shall be escalated to a human with an explicit override requirement. |
| FR-16 | The system shall log every AI-proposed schedule, every human approval/rejection/override, and every resulting calendar/SAP PM write-back with timestamp, actor, and payload reference. |
| FR-17 | The system shall compute and report schedule-compliance, resource-utilization, and unnecessary-servicing KPIs on a rolling basis using `pm_schedule_history` data. |

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | The system shall generate a full-horizon (13-week, plant-wide) candidate schedule within 5 minutes under normal load (up to 2,000 in-scope assets); incremental re-optimization of a disruption-impacted subset shall complete within 60 seconds. |
| NFR-2 | If the constraint solver cannot find a feasible full-horizon solution within its allotted time budget (default 3 minutes for CP-SAT before falling back to the heuristic solver), it shall relax soft constraints in a defined, documented priority order rather than fail silently or hang. |
| NFR-3 | The system shall be available 99.5% of the time during plant operating hours, excluding scheduled maintenance windows communicated at least 5 business days in advance. |
| NFR-4 | All AI-proposed schedules, rationale traces, and write-back actions shall be logged in an immutable audit store with a minimum 3-year retention, supporting internal audit and compliance review. |
| NFR-5 | No write-back to SAP PM (order release) or Outlook Calendar (event publish) shall occur without a preceding logged human approval, except for read-only rationale generation. |
| NFR-6 | Every schedule rationale and checklist step shall cite the specific source record or document section it is derived from; unattributed or fabricated citations are treated as a defect. |
| NFR-7 | All data in transit between connectors (SAP PM, ERP, Outlook, Teams, SQL Database) and the AI orchestration layer shall be encrypted (TLS 1.2+); no maintenance data shall be persisted outside the customer's designated data residency boundary except in short-lived, encrypted working memory. |
| NFR-8 | The system shall support role-based access control such that Technicians can view only their own assignments and checklists, Planners/Engineers can view and approve plant/line-level schedules, and Plant Managers can view summary KPI dashboards without task-level write access. |
| NFR-9 | The natural-language re-planning interface shall degrade gracefully — if intent extraction confidence falls below a defined threshold, the system shall ask a clarifying question rather than execute an ambiguous change. |

## Data Requirements

| Data | Source | Frequency | Quality Requirement |
|---|---|---|---|
| Equipment master, OEM service intervals, runtime hours | SAP PM (Equipment Master, Maintenance Plan) / SQL Database `dim_equipment` | Daily batch; runtime near-real-time where OT integration exists | `equipment_id` must be unique and match SAP PM; `oem_service_interval_hours` must be non-null for all in-scope assets |
| Production plan and plant calendar | ERP (`erp_production_plan`, `Plant Calendar`) | Daily batch | Staging cache staleness must not exceed 48 hours before triggering a scheduler warning |
| Technician roster, certification, shift, availability | HR/roster system + Outlook Calendar free/busy | Roster: weekly; free/busy: real-time on query | `skill_cert` values must map to a maintained certification taxonomy; availability data must reconcile with live free/busy at assignment time |
| PM schedule history (planned/completed dates, status, variance) | SAP PM order confirmations / SQL Database `fact_maintenance_history` | Continuous (on order confirmation) | `status` must use a controlled vocabulary (Completed On Time, Completed Late, Missed, Rescheduled, Skipped – Production Conflict) |
| OEM manuals and plant SOPs | SharePoint document library | On document update (event-driven re-index) | Documents must be version-tagged; retrieval must resolve to the correct manual revision for the specific equipment model/serial |

## Stakeholders & Roles

| Stakeholder | Role |
|---|---|
| Plant Maintenance Manager | Business Owner; accountable for schedule-compliance and cost-of-maintenance KPIs |
| Maintenance Planner | Primary user; requests schedules, reviews and approves AI proposals, resolves resource gaps |
| Maintenance Engineer | Reviews and co-approves schedules and re-optimizations, especially for Critical assets; owns checklist/SOP accuracy |
| Technician | Executes scheduled PM tasks using generated checklists; consulted on availability and feasibility |
| Plant Manager | Accountable for overall plant reliability performance; consumes summary KPI reporting |
| Production Scheduler | Consulted; provides/owns the ERP production plan that constrains feasible PM windows |
| Manufacturing AI Platform Lead | Technical Owner; accountable for model performance, connector health, and governance |

## Assumptions & Constraints

- SAP PM is the authoritative system of record for equipment master data and maintenance plan intervals across all in-scope plants at go-live.
- ERP production plan data is available at a line-level granularity sufficient to determine day-level feasibility windows; shift-level granularity is a future enhancement, not a go-live requirement.
- Technician certification data exists in a structured, queryable roster system (or is migrated to one) prior to go-live; the assistant does not infer certification from unstructured HR records.
- Outlook/Exchange is the plant's calendaring system; sites using an alternative calendaring platform require a connector substitution, which is out of scope for this use case's initial release.
- The constraint solver operates on a finite, bounded horizon (default 13 weeks); indefinite-horizon optimization is not required.
- Planners and Maintenance Engineers retain final approval authority; the assistant is designed as a decision-support and automation-of-drudgery tool, not an autonomous scheduler.

## Acceptance Criteria

| Acceptance Criterion | Maps to Requirement(s) |
|---|---|
| Given an asset at 90% interval utilization with no production conflict in the horizon, the system proposes a date before the interval reaches 100% utilization. | FR-1, FR-2 |
| Given a line with a committed ERP production plan window, no proposed PM task date for an asset on that line falls inside the window (unless designated production-permissible). | FR-3 |
| Given a plant shutdown day in the Plant Calendar, the system either schedules eligible PM tasks into that window preferentially or excludes it from the feasible domain per FR-4 configuration. | FR-4 |
| Given a technician roster with certification and free/busy data, every task assignment in the output holds the required certification and shows no calendar conflict at assignment time. | FR-5, FR-6 |
| Given a two-week test horizon with more due tasks than certified-technician-days available, the system produces a resource-gap report identifying every unstaffed task with the missing certification. | FR-6, FR-7 |
| Given a scheduled task, the generated checklist includes at least one source citation per OEM-derived step and correctly flags any LOTO/permit-required step. | FR-8, FR-9 |
| Given any scheduled task, the system returns a rationale string referencing at least one specific constraint (production window ID, interval deadline, or technician assignment) that determined the date. | FR-10 |
| Given a generated schedule, no Outlook Calendar event or SAP PM order is created until a logged approval action exists for that schedule batch. | FR-11, NFR-5 |
| Given a simulated production-plan-change disruption affecting 2 of 40 scheduled tasks, the re-optimization output changes only those 2 tasks (plus any tasks displaced as a direct consequence) and leaves the other 38 unchanged. | FR-12, FR-13 |
| Given a natural-language re-planning request ("push Line 3 PM two weeks"), the system returns a structured diff for confirmation before any write-back occurs. | FR-14, NFR-9 |
| Given a Critical-criticality asset that cannot be scheduled within the horizon without breaching its OEM interval, the system escalates rather than silently accepting the breach. | FR-15 |
| Given any completed scheduling run, an audit query returns the full chain of proposal, approval/rejection, and write-back for that run. | FR-16, NFR-4 |
| Given at least one full quarter of historical data, the system computes and displays schedule compliance %, unnecessary-servicing rate, and technician utilization variance consistent with the KPI definitions in Business Process.md. | FR-17 |
