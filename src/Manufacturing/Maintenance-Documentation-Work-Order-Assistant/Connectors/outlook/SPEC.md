# Connector Specification: Outlook (Mail)

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

The Maintenance Documentation & Work Order Assistant uses the Outlook connector as the formal, auditable distribution channel for finished documents, once they have passed human review:

- **Outbound Notification:** The Report Writer skill sends approved maintenance completion reports and repair completion certificates via `sendMail` to engineering, plant management, and — where warranty/compliance relevance applies — a designated compliance distribution list, with the report attached as a PDF and the AI-generated-content disclaimer footer applied per the shared HTML template.
- **Outbound Notification (shift handover):** The Shift Summary Generator skill sends the approved shift handover summary via Outlook to planners and plant management as a parallel channel to the Teams channel post, ensuring stakeholders who are not actively monitoring Teams still receive the handover.
- **Distribution List:** Recipient groups are configured per plant (e.g., `plant-a-maintenance-engineering@company.com`, `plant-b-shift-supervisors@company.com`) matching the two-plant Sample Data scope (Plant A – Greenville, Plant B – Monterrey) and mapped to the roles defined in Business Requirements.md Stakeholders & Roles.
- **Fallback channel:** Per the canonical error-handling pattern, if a Microsoft Teams post fails (e.g., channel unavailable), the corresponding shift handover or completion report is still delivered via this Outlook connector, ensuring the human review-and-distribute step is never silently lost to a single-channel outage.
- **Inbound ingestion (optional, not enabled in initial scope):** Reserved for a future phase where a technician could forward a photo or voice memo by email to the service mailbox as an alternate submission channel to the Teams-based upload described in Technical Design.md.
