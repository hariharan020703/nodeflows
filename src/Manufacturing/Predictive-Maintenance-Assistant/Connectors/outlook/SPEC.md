# Connector: Outlook (Mail)

*Adapted from the canonical specification at `Shared-Library/Connectors/Outlook.md`. Content below is consistent with that canonical spec; see this document's "Use in This Use Case" section for how the Predictive Maintenance Assistant specifically uses it.*

## Overview

Connector to Microsoft Outlook/Exchange Online for sending AI-generated email notifications (maintenance reports, escalations, shift summaries) and, where configured, ingesting inbound emails (e.g., vendor quotes, technician notes) as source data.

## Reusability Scope

Canonical connector for any department needing email-based notification or ingestion (Maintenance reporting, Procurement vendor correspondence, Quality non-conformance alerts).

## Authentication & Security

- **Protocol:** Microsoft Graph API (`/users/{id}/sendMail`, `/me/messages`) over OAuth 2.0.
- **Auth method:** Azure AD app registration using application permissions (`Mail.Send`, `Mail.Read` scoped to a dedicated service mailbox, e.g., `maintenance-ai@company.com`) rather than acting as arbitrary users.
- **Authorization:** Sends are restricted to pre-approved distribution lists/mailboxes configured per use case; the connector cannot send to arbitrary external domains without an explicit allow-list entry.

## Core Data Objects

| Object | Description |
|---|---|
| Outbound Notification | HTML email with report/summary and attachments (PDF work order, RCA report) |
| Inbound Ingestion (optional) | Parsed emails matching a subject/sender filter, used as unstructured input (e.g., vendor quote PDFs) |
| Distribution List | Pre-configured recipient groups (Shift Supervisors, Plant Manager, Procurement) |

## Integration Pattern

- **Outbound:** Graph `sendMail` with HTML body generated from the report template, attachments streamed as base64 MIME parts, capped at 25MB per Graph limits.
- **Inbound (optional):** Graph subscription/webhook on the service mailbox's inbox, filtered by sender/subject rules, routed to the relevant AI skill for parsing.
- **Templating:** All outbound emails use a shared HTML template (branding, disclaimer footer noting AI-generated content) maintained centrally.

## Latency & Refresh

- Send confirmation: < 5 seconds. Inbound webhook delivery: typically < 1 minute of message arrival.

## Error Handling

- Send failures retried 3x; persistent failure falls back to posting the notification in the corresponding Teams channel and logging an alert for IT.
- Bounce/NDR handling monitored via a dedicated mailbox rule; repeated bounces to a recipient trigger a distribution-list data-quality alert.

## Sample Payload (Send Mail)

```json
{
  "message": {
    "subject": "Predictive Maintenance Alert: Pump01 (Line 3) — Action Required",
    "body": { "contentType": "HTML", "content": "<p>Predicted failure window: 48–72 hrs...</p>" },
    "toRecipients": [{ "emailAddress": { "address": "shift-supervisor-planta@company.com" } }]
  }
}
```

## Use in This Use Case

The Predictive Maintenance Assistant uses Outlook for two purposes:

- **Fallback delivery** for high-priority risk briefings when Teams delivery fails after 3 retries, per the canonical spec's error-handling pattern, ensuring Priority 1/2 alerts are never silently dropped.
- **Scheduled reporting delivery** for the weekly Plant Manager risk-and-performance briefing (see "Weekly Plant Manager Risk & Performance Briefing" prompt in `Prompt Library.md`), sent from the dedicated service mailbox `maintenance-ai@company.com` to the Plant Manager distribution list, using the shared HTML template with the standard AI-generated-content disclaimer footer.
- Sends are restricted to the pre-approved distribution lists configured during onboarding (Shift Supervisors, Maintenance Engineers, Plant Manager) — the connector is not configured to send to arbitrary external domains for this use case.
- Inbound ingestion is not enabled for this use case in the initial rollout scope (see `Business Requirements.md`, Out-of-Scope); it may be enabled in a later phase if vendor-quote ingestion becomes relevant to the Maintenance Planner skill's parts-availability workflow.
