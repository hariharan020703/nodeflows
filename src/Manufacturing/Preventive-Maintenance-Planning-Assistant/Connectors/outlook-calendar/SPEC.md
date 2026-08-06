# Connector Specification: Outlook Calendar

*Adapted from the canonical spec at `Shared-Library/Connectors/Outlook-Calendar.md`. Core specification reproduced below for reference; see "Use in This Use Case" for how the Preventive Maintenance Planning Assistant specifically consumes this connector.*

## Overview
Connector to Microsoft Outlook/Exchange calendars for reading technician and asset availability, and for creating/updating preventive maintenance calendar events and technician work assignments.

## Reusability Scope
Canonical connector for any department scheduling resource- or asset-bound activities (Maintenance PM scheduling, Production changeover scheduling, Quality audit scheduling).

## Authentication & Security
- **Protocol:** Microsoft Graph API (`/users/{id}/calendar/events`, `/me/calendarView`) over OAuth 2.0.
- **Auth method:** Azure AD application permissions (`Calendars.ReadWrite`) scoped to designated resource calendars (technician team calendars, shared "Plant A Maintenance Schedule" resource calendar) — not general access to arbitrary personal calendars.
- **Authorization:** Write access limited to the shared maintenance resource calendar; write to an individual technician's personal calendar requires that technician's explicit delegate permission grant.

## Core Data Objects
| Object | Description | Key Fields |
|---|---|---|
| Calendar Event | PM task, work order appointment | Subject, Start/End, Location (asset), Attendees (technicians), Categories |
| Free/Busy | Technician availability | Availability status per time slot |
| Resource Calendar | Shared asset/technician-crew calendar | Crew ID, Shift Pattern |

## Integration Pattern
- **Read:** `calendarView` query for a date range to determine technician and asset availability before proposing a PM schedule.
- **Write:** Event creation/update via Graph API, including required attendees (technicians) so the invite appears on their personal calendars with accept/decline tracked back to the scheduler.
- **Conflict detection:** Free/busy check performed before write; conflicting slots trigger the AI scheduler to propose the next best alternative rather than double-booking.

## Latency & Refresh
- Availability read: < 2 seconds. Event creation: < 3 seconds, synchronous.

## Error Handling
- Double-booking conflicts return a structured error with the conflicting event; the scheduler skill retries with the next available slot automatically (up to 3 alternatives) before escalating to a human planner.

## Sample Payload (Event Create)
```json
{
  "subject": "PM-00231: Quarterly Lubrication — Conveyor Motor 04",
  "start": { "dateTime": "2026-08-11T08:00:00", "timeZone": "Asia/Calcutta" },
  "end": { "dateTime": "2026-08-11T10:00:00", "timeZone": "Asia/Calcutta" },
  "location": { "displayName": "Line 3 — Conveyor Motor 04" },
  "attendees": [{ "emailAddress": { "address": "technician.raj@company.com" }, "type": "required" }]
}
```

## Use in This Use Case

Outlook Calendar is the primary read source for technician availability (feeding the Resource Planner skill's free/busy filter, alongside the `technician_availability.csv`-modeled roster/shift data) and the primary write target for the published PM schedule (via the Calendar Optimizer skill).

**Objects specifically consumed:**
- **Free/Busy:** queried by the Resource Planner skill for every candidate technician on a proposed PM date before finalizing an assignment — this is the authoritative real-time check that supersedes the `available_dates` field in the staged roster table if the two disagree (e.g., a technician booked a personal appointment after the roster was last synced).
- **Calendar Event (write):** the Calendar Optimizer skill creates one event per scheduled PM task on the shared "Plant Maintenance Schedule" resource calendar, with `Location` set to the equipment description (e.g., "Line 1 — Centrifugal Pump P-101"), `Attendees` set to the assigned technician(s) from the Resource Planner output, and `Subject` formatted as `PM-{plan_id}: {task_type} — {equipment description}` (matching the canonical sample payload pattern).
- **Resource Calendar:** the plugin is provisioned against a single shared resource calendar per plant (e.g., `Plant A - Maintenance Schedule`); it does not have blanket write access to arbitrary technician personal calendars, consistent with the canonical authorization model.

**Conflict handling specific to this use case:** when a free/busy check reveals a conflict during the Calendar Optimizer's pre-publish check (Step 2 of the Calendar Optimizer skill), the assistant does not simply pick the next open slot in isolation — it re-invokes the Maintenance Scheduler's constraint model with that slot excluded, ensuring the replacement slot still respects all other hard constraints (production windows, OEM interval deadlines) rather than trading one conflict for another.
