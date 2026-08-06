# Connector Specification: Microsoft Teams

## Overview
Connector for posting AI-generated alerts, summaries, and interactive adaptive cards into Microsoft Teams channels and direct messages, and for accepting technician replies (approve/reject, add notes) back into the AI workflow.

## Reusability Scope
Canonical connector for any manufacturing department needing conversational delivery of AI outputs to shift teams, engineers, or planners (Maintenance, Production shift handover, Quality alerting, EHS incident notification).

## Authentication & Security
- **Protocol:** Microsoft Graph API / Teams Bot Framework, using an Azure Bot registration.
- **Auth method:** Azure AD application registration, OAuth 2.0 client credentials for proactive messaging; Bot Framework SDK for interactive adaptive card round-trips.
- **Authorization:** Bot installed at the team/channel level by a Teams admin, scoped only to the channels explicitly onboarded (e.g., `Plant A - Maintenance Shift Channel`). No blanket tenant-wide messaging permission.

## Core Data Objects
| Object | Description |
|---|---|
| Channel Message | Posted alert, RCA summary, or shift handover, rendered as an Adaptive Card |
| Adaptive Card Action | User response to a card (Approve Work Order, Acknowledge Alarm, Add Comment) |
| Direct Message | 1:1 escalation to an on-call technician or shift supervisor |
| Meeting/Escalation Trigger | Optional auto-scheduled Teams huddle for critical breakdowns |

## Integration Pattern
- **Outbound:** Proactive Adaptive Card post to a channel webhook/bot endpoint, including structured buttons (Acknowledge, Escalate, View Full Report).
- **Inbound:** Bot Framework activity handler captures button-click payloads and free-text replies, routes them back to the originating AI skill/workflow (e.g., "Approve" click triggers SAP PM work-order confirmation write-back).
- **Threading:** Each AI-initiated conversation maintains a `conversationId` correlated to the source event (alarm ID, notification number) so replies stay contextually linked.

## Latency & Refresh
- Message delivery: < 3 seconds. Interactive round-trip (card click → workflow action): < 5 seconds.

## Error Handling
- Delivery failures retried 3x with backoff; persistent failure escalates via Outlook email as a fallback channel.
- Bot rate limits respected per Microsoft Graph throttling guidance; message batching used for multi-recipient broadcasts.

## Sample Adaptive Card Payload (abridged)
```json
{
  "type": "AdaptiveCard",
  "body": [
    { "type": "TextBlock", "text": "⚠ High vibration predicted failure — Pump01, Line 3", "weight": "Bolder" },
    { "type": "TextBlock", "text": "Predicted failure window: 48–72 hrs. Confidence: 87%." }
  ],
  "actions": [
    { "type": "Action.Submit", "title": "Create Work Order", "data": { "action": "create_wo", "equipment": "10004521" } },
    { "type": "Action.Submit", "title": "Dismiss", "data": { "action": "dismiss" } }
  ]
}
```

## Use in This Use Case

Microsoft Teams is the sole human-in-the-loop delivery and approval surface for the Breakdown Investigation Copilot — no root cause conclusion or corrective action reaches SAP PM or SharePoint without passing through a Teams Adaptive Card round-trip.

- **Outbound:** On completion of the RCA Analyzer and Corrective Action Generator steps, the Copilot posts an Adaptive Card to the `Plant A - Maintenance Shift Channel` summarizing incident `INC-2026-0804-01` (Equipment `10004521`), the condensed timeline, the ranked root causes with confidence levels, and the draft corrective action plan, with `Approve`, `Edit / Add Evidence`, and `Reject` actions, tagging the responsible maintenance engineer.
- **Inbound:** The Bot Framework activity handler captures the engineer's button click. An `Approve` action triggers the Orchestrator's SAP PM write-back and SharePoint publish sequence (FR-11/FR-12); an `Edit / Add Evidence` action routes the engineer's free-text correction or additional evidence back into the RCA Analyzer for re-reasoning; a `Reject` action logs the rejection and hands the incident to manual investigation as the fallback path.
- **Threading:** The `conversationId` for each investigation is set to the `incident_id` (`INC-2026-0804-01`), ensuring that if the engineer replies hours later or from a different device, the response is still correctly correlated to the original investigation context.
- **Escalation use:** For Priority 1 breakdowns exceeding the configured downtime threshold (default 4 hours) without an engineer response, the Copilot escalates via a direct message to the shift supervisor and, per the canonical fallback, an Outlook email if Teams delivery itself fails.
