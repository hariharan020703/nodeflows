# Plugin Guide — Maintenance Copilot

## 1. Purpose

Maintenance teams today react to equipment failures after they occur — diagnosing, scheduling, and repairing under emergency time pressure, which drives excess downtime, production loss, and inflated repair cost relative to planned work. Maintenance Copilot is the plugin packaging of the Predictive Maintenance Assistant: it continuously analyzes machine health signals — vibration, temperature, current draw, runtime, alarms, and historical maintenance records — using time-series anomaly detection and remaining-useful-life (RUL) modeling fused with LLM-based reasoning and retrieval-augmented generation over SOPs and RCA history, so that failures are predicted with enough lead time and enough diagnostic specificity to be converted from emergency breakdown work into planned maintenance, while keeping accountable humans in control of every system-of-record write-back.

The plugin's `Skills/` and `Connectors/` now follow Claude's real Agent Skills and MCP connector formats (per `Shared-Library/Templates/SKILL-MD-SPEC.md` and `Shared-Library/Templates/MCP-CONNECTOR-SPEC.md`), and `Plugin/` follows the real Claude Code/Cowork plugin manifest format (per `Shared-Library/Templates/CLAUDE-PLUGIN-SPEC.md`) — not the earlier invented flat-file/manifest schema.

## 2. Prerequisites

- **SAP PM:** OData services (`API_MAINTNOTIFICATION`, `API_MAINTENANCEORDER`, `API_EQUIPMENT`) enabled; dedicated service communication user (`SVC_AI_MAINT`) provisioned with authorization objects `I_QMEL`, `I_AFVGD`.
- **SQL Database:** Staging schema provisioned (`fact_sensor_readings`, `fact_alarms`, `fact_maintenance_history`, `dim_equipment`, `fact_failure_predictions`); read-only (`svc_ai_readonly`) and write-scoped (`svc_ai_writer`) service accounts created.
- **OPC-UA/PLC:** Edge collector deployed in the OT/IT DMZ; X.509 certificates issued by plant PKI; tag-to-Equipment-ID mapping table populated for all in-scope equipment.
- **SharePoint tenant setup:** Azure AD app registration with `Sites.Read.All` (and scoped `Sites.ReadWrite.All` for the AI-Generated subfolder); SOP Library and RCA archive populated with EquipmentType/Model metadata.
- **Microsoft Teams tenant setup:** Azure Bot registration installed at the target channel(s) (e.g., `Plant A - Maintenance Shift Channel`) by a Teams admin.
- **Outlook:** Dedicated service mailbox (e.g., `maintenance-ai@company.com`) provisioned with `Mail.Send`/`Mail.Read` application permissions; distribution lists (Shift Supervisors, Maintenance Engineers, Plant Manager) confirmed.
- **Model access:** Claude Code/Cowork access provisioned for the maintenance team, with the six MCP server tokens referenced below stored in the organization's secrets manager (never hardcoded) and exported as environment variables before installation.
- **MCP server implementations deployed:** A real MCP server must be running at each of the six URLs declared in `Plugin/.mcp.json` (`sap-pm`, `sql-database`, `opc-ua-plc`, `sharepoint`, `microsoft-teams`, `outlook`), implementing the tool contracts in each connector's `tools.json`. This plugin only declares and connects to those servers — it does not implement them (see each connector's `Connectors/<name>/SPEC.md` for the integration pattern the server must implement against).

## 3. Installation Steps

This plugin follows the real Claude Code/Cowork plugin install flow (see `Shared-Library/Templates/CLAUDE-PLUGIN-SPEC.md`), not a generic orchestration-platform import.

1. Set the required MCP authorization-token environment variables in the shell/session that will run Claude Code (or in your secrets manager, if it injects them automatically): `SAP_PM_MCP_TOKEN`, `SQL_DATABASE_MCP_TOKEN`, `OPC_UA_PLC_MCP_TOKEN`, `SHAREPOINT_MCP_TOKEN`, `MICROSOFT_TEAMS_MCP_TOKEN`, `OUTLOOK_MCP_TOKEN` — one per connector declared in `Plugin/.mcp.json`, following the least-privilege scopes defined in each `Connectors/<name>/SPEC.md`.
2. Add the marketplace (or local path, during development/pilot) that hosts this repository's plugins: `/plugin marketplace add <org>/<repo>` (or a local path pointing at this use case's `Plugin/` directory).
3. Install the plugin: `/plugin install maintenance-copilot@<marketplace-name>`.
4. Claude Code/Cowork reads `Plugin/.claude-plugin/plugin.json`, registers the six MCP servers declared in `Plugin/.mcp.json` (prompting for any of the token env vars from Step 1 that are not already set), and loads the skill folders under `Skills/` (`fault-diagnosis`, `root-cause-analysis`, `maintenance-planner`, `sop-retrieval`, `maintenance-report-writer`).
5. Confirm each MCP server connects successfully (Claude Code reports connection status per server); a server that fails to connect leaves its tools unavailable without blocking the others.
6. Deploy the SQL staging schema via migration scripts and validate connectivity with `svc_ai_readonly`/`svc_ai_writer` (consumed by the `sql-database` MCP server).
7. Deploy the OPC-UA edge collector, load the tag subscription list, and confirm 72-hour local buffering is operational (consumed by the `opc-ua-plc` MCP server).
8. Index the SharePoint SOP Library and RCA archive into the vector store; confirm webhook-triggered re-indexing is active (consumed by the `sharepoint` MCP server).
9. Load the prompts from `Prompt Library.md` into whichever prompt/versioning store your team uses; these are reference prompts for the skills above, not something the plugin manifest itself declares.
10. Configure the parameters listed in Section 4 (Configuration Reference) for the target plant — these are operational thresholds consumed by the skills' instructions, not plugin.json fields.
11. Run the Validation / Smoke Test in Section 5 in a sandbox environment before activating in production.
12. Once validated, confirm skills are available (matched automatically by their `description` frontmatter, or invoked manually via `/fault-diagnosis`, `/root-cause-analysis`, `/maintenance-planner`, `/sop-retrieval`, `/maintenance-report-writer`) and that Teams/Outlook delivery reaches the pilot channel/distribution list.

## 4. Configuration Reference

| Parameter | Description | Default |
|---|---|---|
| `anomaly_score_threshold` | Composite anomaly score (0–1) above which the diagnostic skill chain is triggered. | 0.75 |
| `rul_confidence_min_days` | Minimum RUL confidence-interval lower bound (days) below which a risk is escalated regardless of anomaly score. | 7 |
| `min_fault_match_threshold` | Minimum similarity score for the Fault Diagnosis skill to report a matched failure mode rather than "no strong match." | 0.55 |
| `min_rca_relevance_threshold` | Minimum relevance score for a retrieved RCA/OEM document to be cited in Root Cause Analysis. | 0.60 |
| `min_sop_relevance_threshold` | Minimum relevance score for a retrieved SOP section to be surfaced rather than "no matching SOP found." | 0.65 |
| `action_window_safety_margin_pct` | Safety margin applied when computing the latest feasible maintenance action start date relative to the predicted failure window. | 25% (min. 24 hours) |
| `teams_channel_pilot` | Target Teams channel for pilot-phase risk briefing delivery. | `Plant A - Maintenance Shift Channel` |
| `outlook_escalation_distribution_list` | Distribution list for weekly Plant Manager briefing and Teams-fallback escalations. | `plant-a-maintenance-leadership@company.com` |
| `weekly_briefing_schedule` | Cron-style schedule for the weekly Plant Manager risk-and-performance briefing. | Monday 06:00 plant local time |
| `sap_pm_notification_priority_mapping` | Criticality-class-by-failure-window mapping used to auto-populate draft notification Priority. | Class A + <72h => 1; Class A + 72h–7d => 2; Class B => 2–3; other => 4 |
| `retry_count_connector` | Retry attempts before failover (e.g., Teams → Outlook) on connector delivery failure. | 3 |
| `model_retrain_cadence_days` | Cadence for scheduled RUL/anomaly model recalibration using newly closed work orders. | 30 |

## 5. Validation / Smoke Test

Using the files in `Sample Data/`:

1. Load `sensor_readings.csv`, `alarm_log.csv`, and `maintenance_history.csv` into the sandbox SQL staging schema.
2. Confirm the anomaly detection pipeline flags equipment `10004521` (Pump01, Line 3) with a rising composite anomaly score as its vibration and bearing temperature trend upward across the sample's 90-day window — this is the intentionally embedded degrading-asset scenario in the sample data.
3. Confirm the Fault Diagnosis skill returns "Bearing wear - outer race defect" as a top-ranked candidate with supporting evidence citations to the specific sensor rows and alarm records.
4. Confirm the Root Cause Analysis skill either cites a retrieved SharePoint document (if a test RCA/OEM document is loaded into the sandbox SharePoint site) or correctly returns "insufficient precedent" if none is loaded.
5. Confirm the SOP Retrieval skill returns a specific section reference (not a full document) when a test SOP is loaded, and returns "no matching SOP found" otherwise.
6. Confirm the Maintenance Planner skill produces a recommended action window that does not conflict with any test PM schedule entry, and correctly flags a conflict when one is deliberately introduced into the test schedule.
7. Confirm the Maintenance Report Writer skill produces a draft SAP PM notification held for approval — verify no write-back occurs to the sandbox SAP PM system without a simulated human approval action.
8. Confirm the risk briefing renders correctly as a Teams adaptive card in the sandbox channel, including both "Create Work Order" and "Dismiss / Monitor" actions.
9. Simulate a Teams delivery failure and confirm fallback delivery to the configured Outlook sandbox mailbox occurs within the configured retry count.

The plugin is considered validated when all nine steps produce the expected output with no ungrounded (uncited) claims and no unauthorized write-back.

## 6. Rollback Plan

- **Disable:** Run `/plugin uninstall maintenance-copilot@<marketplace-name>` to remove the plugin from the active session/project, or disable it in Claude Code's plugin settings without removing the marketplace entry; this immediately stops new anomaly-detection-triggered skill invocations and scheduled briefings while leaving all six MCP servers, connectors, and data pipelines intact and reachable outside Claude Code.
- **Uninstall:** After running `/plugin uninstall`, also run `/plugin marketplace remove <org>/<repo>` if the marketplace entry itself should be removed; revoke the `SVC_AI_MAINT`, `svc_ai_readonly`/`svc_ai_writer`, and the Azure AD app registrations for SharePoint/Teams/Outlook if the plugin is being fully decommissioned (not just paused), and unset the six MCP token environment variables from Section 3.
- **Data retention on rollback:** All audit logs, model prediction history (`fact_failure_predictions`), and archived RCA reports remain in place after disablement/uninstall for continuity of records and potential re-activation; no destructive data deletion is performed as part of rollback.
- **Fallback to manual process:** On disablement, maintenance teams revert to the current-state manual process described in `Business Process.md`; no in-flight SAP PM notifications/work orders are affected since all write-backs already required human approval and are recorded as standard SAP PM transactions.
- **Re-activation:** The plugin can be re-enabled without data loss once the underlying issue (e.g., a connector credential problem or a model-performance regression) is resolved; re-run the Validation / Smoke Test in Section 5 before returning to production traffic.

## 7. Reusability Notes

The five skills and six connectors packaged in Maintenance Copilot are designed for cross-department reuse within the Manufacturing AI Accelerator Library:

- **SAP PM, SQL Database, SharePoint, Microsoft Teams, and Outlook connectors** are canonical, department-agnostic connectors (see each connector's "Reusability Scope" section) already reused by other Maintenance use cases (Breakdown RCA Copilot, Preventive Maintenance Planning Assistant) and applicable to Quality, Production, and EHS with only the underlying document corpus, table schema, or channel changing.
- **OPC-UA/PLC** is directly reusable by Production (OEE/throughput monitoring) and Quality (in-line process parameter capture) without modification to the connector itself.
- **Fault Diagnosis** and **Root Cause Analysis** skills' core pattern — similarity-match a live signal against a curated historical library, then build an evidence-limited causal chain via RAG — transfers to Quality (non-conformance RCA) and EHS (incident investigation) by swapping the underlying fault-signature library and document corpus.
- **Maintenance Planner**'s conflict-aware resource scheduling logic transfers to any department coordinating shared crew/equipment/parts constraints against a deadline.
- **SOP Retrieval** and **Maintenance Report Writer** are general-purpose document-grounded retrieval and human-gated drafting patterns applicable to any department with a system-of-record equivalent to SAP PM and a document-grounding source equivalent to SharePoint.
