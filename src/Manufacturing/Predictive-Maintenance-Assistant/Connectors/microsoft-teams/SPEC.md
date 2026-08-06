# Connector: Microsoft Teams

*Adapted from the canonical specification at `Shared-Library/Connectors/Microsoft-Teams.md`. Content below is consistent with that canonical spec; see this document's "Use in This Use Case" section for how the Predictive Maintenance Assistant specifically uses it.*

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
    { "type": "TextBlock", "text": "High vibration predicted failure — Pump01, Line 3", "weight": "Bolder" },
    { "type": "TextBlock", "text": "Predicted failure window: 48–72 hrs. Confidence: 87%." }
  ],
  "actions": [
    { "type": "Action.Submit", "title": "Create Work Order", "data": { "action": "create_wo", "equipment": "10004521" } },
    { "type": "Action.Submit", "title": "Dismiss", "data": { "action": "dismiss" } }
  ]
}
```

## Use in This Use Case

The Predictive Maintenance Assistant uses Microsoft Teams as its primary human-in-the-loop delivery and approval channel:

- Risk briefings composed by the "Failure-Risk Briefing for Teams" prompt (see `Prompt Library.md`) are posted as adaptive cards to the `Plant A - Maintenance Shift Channel`, including the equipment, predicted failure window, confidence, and two decision actions: "Create Work Order" and "Dismiss / Monitor".
- Button-click responses (`create_wo` / `dismiss`) are routed back through the Bot Framework handler to trigger the Maintenance Report Writer skill's notification drafting step, or to close out the risk item as monitored-only.
- Each conversation's `conversationId` is correlated to the triggering anomaly/prediction record in `fact_failure_predictions`, so a technician's later reply ("checked it, vibration is fine now") stays linked to the original risk event for audit purposes.
- Persistent Teams delivery failures fall back to Outlook per the canonical spec's error-handling pattern, ensuring a critical high-priority (Priority 1) risk briefing is never silently lost.
