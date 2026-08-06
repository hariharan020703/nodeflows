# Plugin Guide: Maintenance Documentation Assistant

## 1. Purpose

Maintenance engineers and technicians spend a disproportionate share of the workday writing up completed repairs, creating SAP PM work orders and notifications, documenting root cause and parts consumption, and preparing shift handover summaries — almost always after the fact, from memory, because the voice memos, notes, and photos captured in the moment are never transcribed or structured. The Maintenance Documentation Assistant closes that gap: it transcribes technician voice recordings, OCRs handwritten notes, analyzes repair photos with a vision-language model, and fuses all three into structured SAP PM work orders, maintenance completion reports, and shift handover summaries — drafted within minutes of the work being done, and always subject to explicit human review and approval before anything is written to SAP PM or distributed to the organization.

## 2. Prerequisites

- SAP PM (ECC or S/4HANA) with `API_MAINTNOTIFICATION`, `API_MAINTENANCEORDER`, and `API_EQUIPMENT` OData services exposed, and a dedicated service communication user (e.g., `SVC_AI_MAINT`) with authorization objects `I_QMEL` and `I_AFVGD` scoped to in-scope plants.
- A Microsoft 365 tenant with SharePoint Online, Microsoft Teams, and Exchange Online provisioned, and Azure AD administrative access to create the required app registrations and Azure Bot registration.
- Azure AD app registration for SharePoint (`Sites.Read.All` plus `Sites.ReadWrite.All` scoped to the AI-Generated archive library) and for Outlook (`Mail.Send`/`Mail.Read` on a dedicated service mailbox).
- Azure Bot registration for Microsoft Teams, installed only on the specific plant/shift channels being onboarded.
- Model access: a speech-to-text (ASR) endpoint, an OCR endpoint, a vision-language model (VLM) endpoint, and an LLM document-generation endpoint, provisioned on the target deployment environment (see Configuration Reference).
- Current, complete SAP PM equipment master and functional location data for all in-scope plants.
- SharePoint SOP/OEM manual/RCA report libraries populated and access-controlled for in-scope plants.

## 3. Installation Steps

This plugin follows Claude Code/Cowork's real plugin installation flow — a directory containing a `.claude-plugin/plugin.json` manifest, a `.mcp.json` MCP server registration, and a `Skills/` folder of Agent Skill subfolders, not a bespoke orchestration-platform registry entry.

1. Stand up the four MCP servers this plugin depends on (SAP PM, SharePoint, Microsoft Teams, Outlook) per the tool manifests in `Connectors/<connector-name>/tools.json`, implementing each server's tool calls against the real SAP OData/Graph API endpoints described in `Connectors/<connector-name>/SPEC.md`. Register each server's OAuth app/service account per that same SPEC.md (SAP PM communication user and client-credentials app; SharePoint, Teams, and Outlook Azure AD app registrations).
2. Add the marketplace or local path that hosts this plugin: `/plugin marketplace add <org>/<repo>` (or a local filesystem path during development/pilot).
3. Install the plugin: `/plugin install maintenance-documentation-assistant@<marketplace-name>`.
4. When prompted, supply the required MCP authorization env vars referenced in `Plugin/.mcp.json`: `SAP_PM_MCP_TOKEN`, `SHAREPOINT_MCP_TOKEN`, `TEAMS_MCP_TOKEN`, `OUTLOOK_MCP_TOKEN`. Claude Code/Cowork reads `.claude-plugin/plugin.json`, registers the four MCP servers from `.mcp.json` using those tokens, and loads the four skill folders under `../Skills/` (`report-writer/`, `voice-to-report/`, `work-order-generator/`, `shift-summary-generator/`), each triggered automatically by its `SKILL.md` description or invoked manually via `/report-writer`, `/voice-to-report`, `/work-order-generator`, `/shift-summary-generator`.
5. Configure the ASR maintenance-vocabulary correction list (equipment nicknames, part numbers, trade jargon) for each in-scope plant, referenced by the `voice-to-report` skill.
6. Confirm all four MCP servers started successfully (tools listed as available to Claude) and that the human-review-gate tools (`sap_pm_commit_write`, `outlook_send_mail`, `sharepoint_upload_ai_generated_file`, `teams_post_adaptive_card`) are reachable but that no write tool executes without an upstream approval step, per the workflow enforced in `Technical Design.md`.
7. Activate the plugin in a sandbox/test environment first, validate against the files in `Sample Data/` using the smoke test below, then promote MCP tokens to production per the sandbox-to-production steps in `Implementation Guide.md`.

## 4. Configuration Reference

| Parameter | Description | Default |
|---|---|---|
| `duplicate_check_lookback_hours` | Lookback window for the Work Order Generator's duplicate-submission check against the same equipment | 24 |
| `transcription_confidence_review_threshold` | Confidence level below which a voice transcript is flagged for extra reviewer attention | `medium` (medium or low triggers a flag) |
| `photo_consistency_review_threshold` | Consistency confidence level below which a photo discrepancy_flag is escalated via Teams direct message | `medium` |
| `shift_end_trigger_schedule` | Cron-style schedule per plant/shift type firing the Shift Summary Generator | Day shift end 18:00 local; Night shift end 06:00 local |
| `sap_write_retry_attempts` | Retry attempts on SAP PM OData write failure before escalating to human-in-the-loop queue | 3 |
| `sharepoint_archive_path_template` | Path template for AI-Generated archive uploads | `/sites/{plant_site}/AI-Generated/WorkOrders/{work_order_ref}/` |
| `teams_review_channel_map` | Mapping of plant → Teams channel ID for review posts and handover distribution | Configured per plant during onboarding (e.g., Plant A → "Plant A - Maintenance Shift Channel") |
| `outlook_distribution_list_map` | Mapping of plant/role → Outlook distribution list address | Configured per plant during onboarding |
| `supported_languages` | Voice/note input languages supported for transcription and OCR | `en`, `es` |
| `escalation_direct_message_enabled` | Whether discrepancy/duplicate flags trigger a Teams direct message escalation in addition to the channel post | `true` |

## 5. Validation / Smoke Test

Using the files in `Sample Data/`, run the following end-to-end scenario before go-live:

1. Feed the two chronological entries for `WO-2026-100205` from `technician_notes.csv` (initial diagnosis and completion note for Motor07) through the Voice-to-Report and Report Writer skills.
2. Confirm the Work Order Generator skill correctly resolves equipment_id `10004555` and drafts a notification citing the specific note phrases about grinding noise, bearing temperature, and vibration.
3. Confirm the Report Writer skill produces a completion report referencing the corresponding row in `work_order_completion.csv` (status: `Completed - Follow-up Required`, labor_hours: 5.0, parts_used: "Motor bearing set 6309-2RS; terminal box gasket"), including a Follow-Up Required section.
4. Approve the draft via the Teams adaptive card in the sandbox channel; confirm the sandbox SAP PM write-back succeeds and an audit log entry is created with the test approver's identity.
5. Trigger the Shift Summary Generator skill using the `SFT-A-0729-D` row from `shift_log.csv` (Plant A, 2026-07-29, Day shift); confirm the generated handover summary's orders_completed/orders_pending figures reconcile with the sandbox SAP PM order status and that the Motor07 issue appears as a notable item.
6. Confirm the approved handover summary posts to the correct sandbox Teams channel and sends via the sandbox Outlook distribution list within 5 minutes of approval.

The plugin is considered validated when all six steps complete without a manual workaround and the audit log correctly records every write-back/distribution action with its approver identity.

## 6. Rollback Plan

- **Disable in place:** Run `/plugin uninstall maintenance-documentation-assistant@<marketplace-name>` (or disable it from the plugin manager) to stop Claude Code/Cowork from loading the skill folders and connecting the four MCP servers; in-flight drafts awaiting human review remain visible in Teams but no new submissions are processed, and no further SAP PM/SharePoint/Teams/Outlook writes occur.
- **Revert to manual process:** Because the plugin only accelerates drafting and never bypasses human approval, technicians and engineers can immediately revert to manually creating SAP PM notifications/work orders and manually compiling shift handovers with zero data loss — no in-flight SAP PM transaction depends on the plugin remaining active.
- **Credential revocation:** If a security concern requires immediate access removal, revoke the SAP PM service user's authorization roles and the Azure AD app registrations' client secrets/certificates; all four connectors fail closed (no read or write access) rather than failing open.
- **Data retained:** All previously generated and approved reports, work orders, and handover summaries remain intact in SAP PM and SharePoint; only new draft generation stops. No rollback action deletes historical audit records.
- **Re-enablement:** Re-run the Validation / Smoke Test scenario above in the sandbox environment before re-enabling in production, particularly if the rollback was triggered by a model or connector issue rather than a routine pause.

## 7. Reusability Notes

The four skills in this plugin are built on patterns directly reusable by other manufacturing departments:

- **Voice-to-Report** (ASR + domain-vocabulary correction) is reusable wherever frontline staff narrate observations verbally — Quality inspector voice notes on non-conformances, EHS incident/near-miss voice reports, Production shift operator voice logs.
- **Report Writer** (fuse chronological field evidence into a cited narrative with an explicit "insufficient evidence" fallback) is reusable for Quality corrective-action closure documentation, EHS incident write-ups, and Production shift-loss narratives.
- **Work Order Generator** (resolve an asset reference against a system-of-record master, draft a structured event record with duplicate detection, gate on human approval) is reusable for drafting a QMS non-conformance record or an EHS incident report against their respective systems of record, replacing only the target schema and connector.
- **Shift Summary Generator** (query system-of-record status, cross-check for drift, surface safety-relevant items first) is reusable by Production for line-status/quality-hold handovers and by Quality for open non-conformance/containment-action handovers.

Because the connectors (SAP PM, SharePoint, Microsoft Teams, Outlook) are the same canonical, department-agnostic connectors used elsewhere in this repository, a department adopting these skills needs only to point them at its own equivalent system-of-record connector and document library — the multimodal processing, fusion, drafting, and human-approval-gate architecture in `Technical Design.md` carries over unchanged.
