# Reusability Notes — Maintenance Scheduler

The constraint-scheduling pattern (asset interval + production-window + resource-capacity constraints solved via CP optimization) is directly reusable by:

- **Quality** — audit/calibration scheduling against production windows.
- **Production** — changeover and tooling-swap scheduling.
- **EHS** — statutory inspection scheduling for pressure vessels/lifting equipment.

Only the constraint set (interval source, blackout source) needs to be re-parameterized per department; the solver and rationale-trace architecture is domain-agnostic.
