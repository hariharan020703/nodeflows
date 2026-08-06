# Plugin Guide — Breakdown Investigation Copilot

This use case's `Skills/` and `Connectors/` folders, and this `Plugin/` folder itself, now follow the real Agent Skills format (`SKILL.md` with YAML frontmatter) and the real MCP connector/plugin manifest formats rather than the earlier invented schema, so the install flow below reflects an actual, loadable plugin.

## 1. Purpose

When a critical asset breaks down, engineers today spend 4–8 hours manually pulling logs, maintenance history, manuals, and operator notes from five disconnected systems before they can even begin forming a root cause hypothesis — and that investigation typically starts only after the line is already back up, when transient evidence has already faded. The Breakdown Investigation Copilot automatically collects all available information the moment a breakdown notification is raised, reconstructs a cross-system incident timeline, identifies and ranks the most probable root cause(s) with cited supporting evidence, and drafts corrective actions and a management-ready RCA report — compressing that 4–8 hour manual effort into a reviewable draft available within 15 minutes, while keeping a maintenance engineer as the final decision authority on every conclusion and every system write-back.

## 2. Prerequisites

- **SAP PM:** `API_MAINTNOTIFICATION`, `API_MAINTENANCEORDER`, `API_EQUIPMENT` OData services activated; dedicated service communication user (`SVC_AI_MAINT`) provisioned with `I_QMEL`/`I_AFVGD` authorization scoped to read broadly and write only to notification/work-order completion fields.
- **MES:** Read-only reporting API key or OAuth client credentials for downtime, production order, and shift/operator objects.
- **Historian Database:** Read-only role scoped to the tag groups for in-scope equipment; a current tag-to-equipment mapping table.
- **SharePoint:** Azure AD app registration with `Sites.Read.All` on the target maintenance sites and a scoped `Sites.ReadWrite.All` limited to the "AI-Generated RCA Reports" subfolder; SOP/manual/RCA report libraries populated with equipment-type metadata.
- **Microsoft Teams:** Azure Bot registration installed by a Teams admin at the target maintenance channel(s) only; target channel and escalation direct-message recipients identified.
- **Model access:** Approved enterprise LLM and embedding model deployment (Azure OpenAI, Claude on Bedrock, or on-prem gateway) cleared for internal operational data, with a vector index infrastructure provisioned for the historical RCA/SOP embeddings.
- **Data readiness:** MES-to-SAP equipment ID mapping and Historian tag-to-equipment mapping validated for all in-scope assets; 6–12 months of historical SAP PM and Historian data available to seed initial MTBF/MTTR baselining and the failure-signature vector index.

## 3. Installation Steps

This plugin follows Claude Code/Cowork's real plugin install flow — a `.claude-plugin/plugin.json` manifest, a `.mcp.json` MCP server registration, and `Skills/<skill-name>/SKILL.md` folders — not a proprietary orchestration-platform registry.

1. Provision the five backing MCP servers first (these are the real, callable implementations behind `Connectors/sap-pm/`, `Connectors/mes/`, `Connectors/historian-database/`, `Connectors/sharepoint/`, and `Connectors/microsoft-teams/`, each built against that folder's `tools.json` manifest): register the SAP PM service account (`SVC_AI_MAINT`), the MES read-only reporting credential, the Historian read-only role, the SharePoint Azure AD app registration, and the Teams Azure Bot registration, per Section 2 above.
2. Set the required environment variables/secrets for each MCP server's bearer token before installing the plugin: `SAP_PM_MCP_TOKEN`, `MES_MCP_TOKEN`, `HISTORIAN_MCP_TOKEN`, `SHAREPOINT_MCP_TOKEN`, `TEAMS_MCP_TOKEN` (referenced by `Plugin/.mcp.json`).
3. Add the marketplace (or local path, during development) that hosts this plugin: `/plugin marketplace add <org>/<repo>` (or a local path such as this repository's root).
4. Install the plugin: `/plugin install breakdown-investigation-copilot@<marketplace-name>`.
5. Claude Code/Cowork reads `Plugin/.claude-plugin/plugin.json`, registers the five MCP servers declared in `Plugin/.mcp.json` (prompting for the environment variables set in step 2), and loads the five skill folders under `Skills/` (`rca-analyzer`, `failure-pattern-matcher`, `incident-timeline-builder`, `corrective-action-generator`, `knowledge-base-search`).
6. Confirm each MCP server connects successfully (a failed connection surfaces as a startup warning rather than blocking the rest of the plugin) and run one read-only tool call per connector (e.g., `historian_get_recorded_values`, `mes_list_downtime_events`) to validate credentials before enabling any write-capable tool (`sap_pm_create_notification`, `sap_pm_append_completion_note`, `sharepoint_publish_rca_report`).
7. Deploy the Investigation Context Store schema and run the initial batch job to embed all existing historical RCA reports and SOPs into the vector index queried by the `sharepoint_vector_search` tool.
8. Configure the triggers (SAP PM notification event filter, MES critical-downtime threshold) and the default ±8-hour retrieval window per Section 4.
9. Run the Validation / Smoke Test (Section 5) in a sandbox environment before promoting to production.
10. Promote to production only after sandbox validation passes and the security/availability review referenced in the Implementation Guide has been signed off.

## 4. Configuration Reference

| Parameter | Description | Default |
|---|---|---|
| `retrieval_window_hours` | Default time window (± hours) around the malfunction start time for MES/Historian retrieval | 8 |
| `max_retrieval_window_hours` | Maximum allowed window for manual/retroactive investigations | 24 |
| `mes_critical_downtime_threshold_minutes` | Minimum downtime duration on a critical line to auto-trigger an investigation from an MES event alone | 30 |
| `similarity_threshold` | Minimum cosine similarity score for a historical case to be returned by Failure Pattern Matcher | 0.70 |
| `top_n_similar_cases` | Number of historical matches returned by Failure Pattern Matcher | 5 |
| `min_root_causes` / `max_root_causes` | Minimum/maximum number of ranked root-cause hypotheses returned by RCA Analyzer | 2 / 5 |
| `partial_data_confidence_cap` | Maximum confidence level allowed when MES or Historian data is unavailable for the window | Medium |
| `priority1_escalation_downtime_hours` | Downtime threshold above which a Priority 1 breakdown triggers a Plant Manager escalation summary | 4 |
| `teams_response_timeout_minutes` | Time to wait for an engineer response before escalating via direct message | 30 |
| `sharepoint_publish_folder` | Target SharePoint subfolder for approved RCA reports | `/RCA Reports/AI-Generated/` |
| `vector_index_refresh_minutes` | Target latency for re-indexing after a SharePoint document change webhook | 15 |

## 5. Validation / Smoke Test

Use the `Sample Data/` files to validate the plugin end-to-end before go-live:

1. Load `Sample Data/incident_log.csv`, `Sample Data/mes_downtime_events.csv`, and `Sample Data/historian_sensor_trend.csv` into the sandbox connectors (or mock connector responses with this data).
2. Manually trigger an investigation for `equipment_id = 10004521`, window `2026-08-03T19:12:00Z` to `2026-08-04T11:12:00Z` (covering incident `INC-2026-0804-01`).
3. **Expected result — Incident Timeline Builder:** a timeline showing the `RATE_REDUCTION` event starting `2026-08-03T20:15:00Z`, the `DEGRADED_FLOW` event at `02:30:00Z`, the `BEARING_FAILURE` stoppage from `03:12:00Z` to `07:45:00Z`, and the corresponding Historian readings (vibration rising 2.1→12.4 mm/s, bearing temperature 58.1→95.4°C) with no unexpected `data_gap` entries in this window.
4. **Expected result — Failure Pattern Matcher:** a match against a seeded historical RCA report for the same equipment's `2026-05-07` vibration-trip incident (`INC-2026-0507-01` in the sample data) with a similarity score at or above the configured threshold.
5. **Expected result — RCA Analyzer:** at least 2 ranked root-cause hypotheses, the top one referencing bearing lubrication starvation with High confidence and citations to the Historian readings and the matched historical case.
6. **Expected result — Corrective Action Generator:** a draft RCA report flagging that the prior corrective action (re-grease only, from the `2026-05-07` incident) did not prevent recurrence, and recommending bearing replacement plus a revised lubrication interval.
7. **Expected result — Teams delivery:** an Adaptive Card posted to the sandbox maintenance channel with functioning Approve / Edit / Reject actions.
8. Confirm that no SAP PM write-back or SharePoint publish occurs until a test Approve action is submitted, and that the write-back/publish completes within 5 seconds of approval with a corresponding audit log entry.
9. Simulate a Historian outage and confirm the investigation still completes, is labeled "Partial Data — Historian Unavailable," and no hypothesis exceeds Medium confidence.

The plugin is considered validated when all nine steps produce the expected result without manual intervention beyond the Approve action itself.

## 6. Rollback Plan

- **Disable triggers first:** Set the SAP PM notification event trigger and MES critical-downtime trigger to disabled in the plugin configuration; this immediately stops new investigations from auto-starting while leaving on-demand manual invocation available if desired, or disable that too for a full stop.
- **Halt in-flight investigations gracefully:** Allow any investigation already past the human-approval gate to complete its already-approved write-back (do not roll back a completed, engineer-approved SAP PM/SharePoint write); cancel any investigation still awaiting engineer review by posting a Teams notice that the Copilot has been temporarily disabled and the investigation should proceed manually.
- **Revoke connector write scope:** As an additional safety measure, revoke the SAP PM write authorization and SharePoint write scope from the service accounts (leaving read-only access intact) so that even a misconfiguration cannot produce an unintended write-back during the rollback window.
- **Uninstall:** Run `/plugin uninstall breakdown-investigation-copilot@<marketplace-name>`; the underlying MCP server registrations (SAP PM, MES, Historian, SharePoint, Teams) may remain configured for reuse by other use cases in this repository (e.g., the Predictive Maintenance Assistant) since they are canonical, shared connectors declared the same way in those plugins' own `.mcp.json`.
- **Data retained:** The Investigation Context Store, audit log, and vector index are retained (not deleted) during rollback so that historical investigations remain auditable and the vector index can be reused if the plugin is later re-enabled.

## 7. Reusability Notes

Every skill and connector in this plugin is designed for reuse beyond Breakdown RCA:

- **Incident Timeline Builder**'s deterministic multi-source join (transactional system + execution system + sensor system, keyed on asset ID and timestamp) is directly reusable by Quality (linking a defect to the process conditions and production order active at the time) and Production (reconstructing unplanned-stop context for OEE analysis).
- **Failure Pattern Matcher**'s embedding-based similarity search generalizes to any department accumulating historical incident reports — Quality's defect investigation archive, or EHS's near-miss/incident report archive — by changing only the failure-signature input fields.
- **Knowledge Base Search** and the **SharePoint** and **Microsoft Teams** connectors are the same canonical connectors used across the Manufacturing AI Accelerator Library and require no department-specific modification to be reused by another Maintenance use case (e.g., Preventive Maintenance Planning Assistant) or another department entirely.
- **RCA Analyzer**'s citation-enforcement pattern (no conclusion without a traceable evidence reference, confidence capped under partial data) is a governance pattern worth reusing in any diagnostic AI use case, not just maintenance — it is the core mechanism that keeps this plugin's category (`diagnostic`) auditable and trustworthy for a Fortune 500 governance review.
