# Implementation Guide: Preventive Maintenance Planning Assistant

## Prerequisites

**Systems:**
- SAP PM (ECC or S/4HANA) with OData services API_MAINTNOTIFICATION, API_MAINTENANCEORDER, API_EQUIPMENT enabled and reachable via SAP Gateway.
- ERP production planning module (SAP ERP/Oracle ERP Cloud/Dynamics 365) with API or extract access to production plan and plant calendar objects.
- Microsoft 365 tenant with Exchange Online (Outlook Calendar) and Microsoft Teams, and Azure AD app registration privileges.
- A SQL Server/PostgreSQL/Snowflake/Azure SQL instance provisioned for the analytics staging layer.
- SharePoint document library containing (or migrated to contain) OEM manuals and plant SOPs in a structured, version-tagged folder scheme.

**Access:**
- A dedicated SAP service communication user (`SVC_AI_MAINT` or equivalent) with the authorization objects described in the SAP PM connector spec.
- Azure AD application registrations for Outlook Calendar (`Calendars.ReadWrite`, scoped to designated resource calendars) and Teams (Bot Framework registration, channel-scoped installation).
- Read-only (`svc_ai_readonly`) and write-scoped (`svc_ai_writer`) SQL service accounts, provisioned per the SQL Database connector spec.
- LLM model access via the organization's approved deployment (Azure OpenAI / Claude on Bedrock / on-prem LLM gateway — see Plugin manifest `deployment.environment`).

**Data readiness:**
- Equipment master data in SAP PM with populated `oem_service_interval_hours` for all in-scope assets (a material data-quality gap here is the single most common go-live blocker; budget time in Discovery to close it).
- A structured technician roster with certification/skill taxonomy consistent with the taxonomy referenced in the Resource Planner skill.
- At minimum, the current quarter's production plan loaded into ERP with line-level granularity.

## Phased Implementation Plan

| Phase | Duration (Illustrative) | Key Activities | Deliverables |
|---|---|---|---|
| 1. Discovery | 3–4 weeks | Validate SAP PM equipment/interval data quality; confirm ERP production-plan granularity; inventory technician certification data; define constraint priority weights and blackout policies with the Plant Maintenance Manager | Data-quality assessment report; constraint-policy configuration document; go/no-go recommendation |
| 2. Data Integration | 4–6 weeks | Stand up SQL staging layer; build/validate SAP PM, ERP, Outlook, and HR-roster extracts; index SharePoint OEM/SOP corpus for RAG | Working staging schema populated with at least one full historical quarter; validated connector credentials in sandbox |
| 3. Skill/Model Build | 5–7 weeks | Implement and tune the constraint solver (hard/soft constraints, relaxation priority order); build Resource Planner matching logic; build and validate Checklist Generator RAG pipeline with citation enforcement; build Calendar Optimizer publish/re-optimization logic | Working skill implementations passing unit and integration test suites against Sample Data |
| 4. Pilot | 4–6 weeks | Run in shadow mode (schedules generated but not published) for one plant/line against Sample Data and one live quarter; compare AI-proposed schedules against Planner's manual schedule for the same period; collect Planner feedback on rationale quality and checklist accuracy | Shadow-mode variance report; UAT sign-off; tuned constraint weights |
| 5. Rollout | Ongoing, phased by line/plant | Enable live publish (with approval gate) for pilot line; expand line-by-line/plant-by-plant; establish post-go-live support cadence | Production go-live per line/plant; training completion records; support runbook |

## Environment Setup Steps

1. **Register connectors in sandbox:** create SAP PM sandbox service user, Azure AD app registrations for Outlook/Teams (sandbox tenant or isolated app registration), and a sandbox SQL Database instance.
2. **Load Sample Data:** populate the sandbox SQL Database staging tables using this use case's `Sample Data/equipment_runtime.csv`, `technician_availability.csv`, and `pm_schedule_history.csv` to validate schema and skill logic before connecting live feeds.
3. **Validate each connector independently:** run a read-only smoke query against SAP PM (equipment master pull), ERP (production plan pull), and Outlook Calendar (free/busy pull for a test technician) before enabling any orchestrated skill flow.
4. **Configure the Teams bot:** register the Bot Framework app, install it into a sandbox "Maintenance Planning — Test" channel, and validate adaptive card round-trip (post card, capture button click, confirm webhook delivery).
5. **Deploy skills to the orchestration environment:** load the four skill definitions (Maintenance Scheduler, Resource Planner, Checklist Generator, Calendar Optimizer) and the plugin manifest into the target orchestration platform per `Plugin/PLUGIN_GUIDE.md`.
6. **Run end-to-end sandbox test:** generate one full schedule cycle against Sample Data, walk it through approval, and confirm write-back into sandbox Outlook Calendar and SAP PM sandbox order creation.
7. **Promote to production:** repeat steps 1–3 against production-scoped credentials with production data access restricted to the pilot line/plant only; do not enable write-back (`human_approval_required_for` actions) until the Pilot phase shadow-mode results are signed off.

## Testing Strategy

| Test Level | Scope | Approach |
|---|---|---|
| Unit | Individual skill logic (constraint model construction, certification matching, citation enforcement, NL intent extraction) | Automated test suite exercising each skill's processing logic against fixed inputs derived from Sample Data, asserting hard-constraint satisfaction and citation presence |
| Integration | Cross-skill data flow (Scheduler → Resource Planner → Checklist Generator → Calendar Optimizer) and connector round-trips | Sandbox environment with mocked/sandboxed connectors; validate end-to-end payloads match connector sample payloads in `Connectors/` specs |
| UAT | Planner and Maintenance Engineer review of generated schedules, rationale clarity, and checklist accuracy for a real (or realistic pilot) asset population | Structured UAT script covering at least: one overdue-Critical-asset scenario, one production-conflict scenario, one resource-gap scenario, one disruption re-optimization scenario |
| Shadow-Mode Validation | Full production data flow, schedule generation, and rationale — but no write-back — run in parallel with the existing manual process for one full planning cycle | Compare AI-proposed vs. Planner-built schedule; measure agreement rate, identify and resolve systematic disagreements before enabling write-back |

**Sample Data-driven test scenarios** (using the files in `Sample Data/`):
- Load `equipment_runtime.csv` and confirm the scheduler correctly flags `EQ-30020` (Boiler BLR-1) and any other asset at ≥85% interval utilization as due-within-horizon.
- Load `technician_availability.csv` and confirm the Resource Planner correctly excludes `TECH-1003` (Weekend Rotation) from weekday-only task assignment eligibility.
- Load `pm_schedule_history.csv` and confirm the KPI reporting logic correctly computes schedule compliance % and correctly categorizes each historical `status` value.

## Change Management & Training Plan

| Audience | Training Focus | Format |
|---|---|---|
| Technicians | How to read AI-generated checklists, safety/permit flags, and "Do Not Skip" callouts; how to confirm completion in SAP PM | 30-minute in-person/floor session + quick-reference card |
| Maintenance Engineers | How to review and approve/override AI-proposed schedules and re-optimizations, especially for Critical assets; how to interpret rationale traces | 90-minute workshop with live sandbox walkthrough |
| Maintenance Planners | Full workflow: requesting schedules, reviewing resource-gap reports, using natural-language re-planning in Teams, escalation paths | Half-day hands-on session using Sample Data scenarios |
| Plant Managers | KPI dashboard interpretation; escalation triggers requiring their attention | 30-minute briefing |

Change management should explicitly address the cultural shift from "the Planner builds the schedule" to "the Planner approves and refines an AI-proposed schedule" — piloting on a single, lower-criticality line first builds trust before expanding to Critical-asset-heavy lines.

## Go-Live Checklist

- [ ] SAP PM, ERP, Outlook Calendar, Teams, and SQL Database connectors validated in production with correct scoped credentials.
- [ ] Equipment master data quality confirmed (no missing `oem_service_interval_hours` for in-scope assets).
- [ ] Technician roster and certification taxonomy loaded and reconciled with Outlook Calendar identities.
- [ ] SharePoint OEM/SOP corpus indexed and RAG retrieval spot-checked for at least the top 20 asset classes by count.
- [ ] Shadow-mode validation completed with documented Planner sign-off on schedule agreement rate.
- [ ] Approval-gate workflow tested end-to-end in Teams with real Planner/Engineer accounts.
- [ ] Audit logging confirmed capturing proposal, approval, and write-back events with correct actor/timestamp.
- [ ] Escalation paths (resource gap, Critical-interval breach, connector outage) tested and routed to the correct role.
- [ ] Training completed and attendance logged for all four audience groups above.
- [ ] Rollback plan (see `Plugin/PLUGIN_GUIDE.md`) reviewed and confirmed executable by the on-call platform team.
- [ ] Pilot line/plant identified and stakeholder sign-off obtained for go-live date.

## Post-Go-Live Support Model

- **Monitoring:** connector health (latency, error rate) and solver performance (solve time, feasibility-relaxation frequency) monitored continuously with alerting on breach of NFR-1/NFR-2 thresholds.
- **Escalation tiers:** Tier 1 (Planner-resolvable issues, e.g., a resource gap) handled directly in Teams; Tier 2 (connector/data-quality issues) routed to the Manufacturing AI Platform Lead; Tier 3 (solver/model defects) routed to the AI engineering team with full audit-trail context attached.
- **Continuous improvement cadence:** monthly review of schedule-compliance KPI trend, resource-gap frequency, and rationale-quality feedback from Planners/Engineers; quarterly re-tuning of soft-constraint weights based on the accumulating `pm_schedule_history` data; SharePoint corpus re-indexed on OEM manual updates.
- **Expansion governance:** each new line/plant added to scope repeats an abbreviated shadow-mode validation (2-week minimum) before write-back is enabled for that scope.
