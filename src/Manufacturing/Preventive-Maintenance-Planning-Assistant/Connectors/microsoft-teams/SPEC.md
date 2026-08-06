# Connector Specification: Microsoft Teams

*Adapted from the canonical spec at `Shared-Library/Connectors/Microsoft-Teams.md`. Core specification reproduced below for reference; see "Use in This Use Case" for how the Preventive Maintenance Planning Assistant specifically consumes this connector.*

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

Teams is the primary conversational surface for two workflows in the Preventive Maintenance Planning Assistant: (1) delivering the Planner's approval gate for AI-generated PM schedules and re-optimizations, and (2) accepting natural-language re-planning requests that the Calendar Optimizer skill parses into constraint-model changes.

**Objects specifically consumed:**
- **Channel Message (Adaptive Card):** the Calendar Optimizer posts a weekly "Proposed PM Schedule — Week of {date}" summary card to the `Plant Maintenance Planning Channel` with per-task Approve/Modify buttons; it also posts re-optimization diff cards (see Calendar Optimizer skill example) whenever a disruption event triggers a schedule change.
- **Adaptive Card Action:** a Planner's "Approve" click on a schedule card triggers the SAP PM work-order release write-back (see SAP-PM.md "Use in This Use Case"); a "Modify" click opens a follow-up free-text exchange handled by the Calendar Optimizer's natural-language re-planning parser.
- **Direct Message:** used for technician-specific notifications (e.g., "You have been assigned PM-20401 on Aug 19 — checklist attached") and for escalating unstaffed resource-gap tasks directly to the Maintenance Engineer on duty.

**Guardrail alignment:** consistent with the connector's authorization model, the bot is installed only in the specific onboarded channel(s) per plant (e.g., `Plant A - Maintenance Planning Channel`) and never broadcasts tenant-wide; every Approve/Modify action is correlated via `conversationId` to the specific `plan_id` batch it refers to, preserving an auditable link between a Planner's Teams click and the resulting SAP PM/Outlook Calendar write-back.
