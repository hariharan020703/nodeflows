# Reusability Notes — Calendar Optimizer

The incremental "warm restart" re-optimization pattern plus natural-language re-planning parsing is reusable by:

- **Production** — changeover/shift-schedule re-optimization around demand changes.
- **Quality** — re-scheduling audits around production disruptions.

The calendar/notification write-back layer (Outlook + Teams) is identical across departments; only the upstream scheduling domain changes.
