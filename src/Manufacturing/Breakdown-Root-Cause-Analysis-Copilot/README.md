# Breakdown Root Cause Analysis Copilot

**Turns hours of manual log-chasing into minutes of AI-assembled evidence — so engineers spend their time fixing the cause, not hunting for it.**

## Business Problem

When a critical asset breaks down unexpectedly, the maintenance engineer's first job is forensic: pull the SAP PM notification, pull MES downtime and shift logs, pull Historian sensor trends for the hours before failure, search SharePoint for the equipment manual and any prior RCA reports on the same failure mode, and interview the operator on shift. In most discrete and process manufacturing plants this manual reconstruction takes **4–8 engineer-hours per breakdown event** for anything beyond a trivial fault, and it is frequently done *after* the line has already restarted — meaning the root cause investigation happens under time pressure, from memory, with source systems that have already moved on to the next shift's data.

Illustrative industry benchmarks (Fortune 500 discrete/process manufacturing, unplanned downtime studies, not client-specific figures):
- Unplanned downtime costs typically range from **$1,500–$25,000+ per hour** depending on line criticality and industry.
- Mean Time To Repair (MTTR) for breakdowns with an ambiguous root cause runs **2–4x longer** than for breakdowns with a fast, correct diagnosis.
- An estimated **30–40% of "repeat" breakdowns** on the same asset stem from a root cause that was never correctly identified or corrected the first time — the same failure mode recurs weeks or months later.

The bottleneck is not a lack of data. It is that the data lives in five disconnected systems (SAP PM, MES, Historian, SharePoint, informal Teams chats) and no one has time to correlate all of it by hand before the next fire needs fighting.

## AI Goal

Automatically collect all available information relevant to a breakdown, reconstruct a time-ordered incident timeline across systems, identify the most probable root cause(s) with supporting evidence, and recommend corrective actions — compressing a 4–8 hour manual investigation into a reviewable draft available within minutes of the breakdown notification being raised.

## Solution Overview

The Breakdown Investigation Copilot is triggered the moment a breakdown notification is created in SAP PM (or a critical downtime event is logged in MES). It immediately pulls the equipment's downtime events from MES, the sensor trend history from the Historian Database for a configurable window before and after the event (default ±8 hours), and the open/prior notifications and maintenance history for that equipment from SAP PM. These three sources are joined on `equipment_id` and timestamp to produce a single, de-duplicated incident timeline — explicitly flagging any gaps where a source system had no data for a given interval rather than silently assuming normal operation.

Once the timeline is assembled, the Copilot runs an embedding-based similarity search against a vector index of historical RCA reports and SOPs stored in SharePoint to surface past breakdowns with matching sensor signatures, equipment type, or failure description. It then performs LLM-based causal reasoning over the combined timeline, sensor trend, and matched historical cases to produce a ranked list of probable root causes, each with a confidence indicator and citations back to the specific log line, sensor reading, or historical report that supports it. The Copilot drafts corrective actions (immediate containment and longer-term preventive fix) and a management-ready RCA report, then posts a summary card into the relevant Microsoft Teams maintenance channel for engineer review, correction, and sign-off before anything is written back to SAP PM or published to SharePoint.

A human maintenance engineer remains the decision authority throughout: the Copilot never closes a notification, changes an equipment record, or publishes a final RCA report without explicit engineer approval.

## Key Capabilities
- Automatic, multi-source ingestion of MES downtime events, Historian sensor trends, and SAP PM notification/order history triggered by a breakdown event.
- Cross-system incident timeline reconstruction joined on `equipment_id` + timestamp, with explicit data-gap flagging.
- Embedding-based similarity search over historical RCA reports and SOPs to find matching past failure signatures.
- LLM-based causal reasoning producing a ranked, evidence-cited list of probable root causes (not a single unexplained answer).
- 5-Why analysis generation grounded in the reconstructed timeline.
- Draft corrective action plans (immediate + preventive) tied to the identified root cause.
- Auto-drafted RCA report suitable for management review, with human-in-the-loop approval before publishing.
- Interactive delivery via Microsoft Teams with Approve / Escalate / Add Evidence actions.

Skills and Connectors below now follow Claude's real Agent Skills (`SKILL.md`) and MCP connector/plugin manifest formats rather than the earlier invented schema.

## Skills Used
| Skill | Path | Purpose |
|---|---|---|
| RCA Analyzer | `Skills/rca-analyzer/SKILL.md` | Performs the core causal reasoning pass — ranks probable root causes with confidence and evidence citations from the assembled timeline. |
| Failure Pattern Matcher | `Skills/failure-pattern-matcher/SKILL.md` | Runs embedding-based similarity search against historical RCA reports and failure signatures to find comparable past breakdowns. |
| Incident Timeline Builder | `Skills/incident-timeline-builder/SKILL.md` | Joins MES, Historian, and SAP PM records by `equipment_id` + timestamp into a single ordered, gap-flagged incident timeline. |
| Corrective Action Generator | `Skills/corrective-action-generator/SKILL.md` | Drafts immediate containment and longer-term preventive corrective actions tied to the ranked root cause(s). |
| Knowledge Base Search | `Skills/knowledge-base-search/SKILL.md` | Retrieves relevant SOPs, OEM manuals, and prior work order history from SharePoint and SAP PM to ground the analysis. |

## Connectors Used
| Connector | Path | Purpose |
|---|---|---|
| SAP PM | `Connectors/sap-pm/` | Source of breakdown notifications, work order history, equipment master data, and MTBF/MTTR history; target for RCA-linked notification updates. |
| MES | `Connectors/mes/` | Source of downtime events, reason codes, shift/operator context, and quality events around the incident window. |
| Historian Database | `Connectors/historian-database/` | Source of high-frequency sensor trend data (vibration, temperature, pressure, flow) before and after the breakdown. |
| SharePoint | `Connectors/sharepoint/` | Source of SOPs, OEM manuals, and historical RCA reports; destination for the published RCA report. |
| Microsoft Teams | `Connectors/microsoft-teams/` | Delivery of the RCA summary and corrective action plan to the maintenance channel, and capture of engineer approve/reject/comment actions. |

## Plugin Name
**Breakdown Investigation Copilot** (plugin manifest `name: breakdown-investigation-copilot`, see `Plugin/.claude-plugin/plugin.json`)

## Folder Contents Index
| Path | Contents |
|---|---|
| `Business Process.md` | Current-state vs. future-state investigation process, process flow diagram, RACI, and KPIs. |
| `Business Requirements.md` | Objective, scope, functional/non-functional requirements, data requirements, acceptance criteria. |
| `Technical Design.md` | Architecture, data flow, AI/model approach (timeline join + similarity search + LLM causal reasoning), security, scalability. |
| `Implementation Guide.md` | Phased rollout plan, environment setup, testing strategy, change management, go-live checklist. |
| `Prompt Library.md` | Production-ready prompts used by the Copilot's skills and as engineer-facing quick actions. |
| `Sample Data/` | `incident_log.csv`, `mes_downtime_events.csv`, `historian_sensor_trend.csv` — a reconstructable sample breakdown (Pump P-301, Line 3, Plant A). |
| `Skills/` | One real Agent Skill folder per skill (`rca-analyzer/`, `failure-pattern-matcher/`, `incident-timeline-builder/`, `corrective-action-generator/`, `knowledge-base-search/`), each with `SKILL.md` and `REFERENCE.md`. |
| `Connectors/` | One folder per connector (`sap-pm/`, `mes/`, `historian-database/`, `sharepoint/`, `microsoft-teams/`), each with the narrative `SPEC.md`, a client-side `mcp-server.json` declaration, and a `tools.json` MCP tool manifest. |
| `Plugin/` | `.claude-plugin/plugin.json` manifest, `.mcp.json` MCP server registration, and `PLUGIN_GUIDE.md` installation/configuration guide. |

## Ownership
- **Business Owner:** Plant Maintenance Manager
- **Technical Owner:** Maintenance AI/Digital Solutions Lead
