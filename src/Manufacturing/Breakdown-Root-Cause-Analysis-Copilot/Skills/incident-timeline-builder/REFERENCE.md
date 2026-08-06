# Reusability Notes — Incident Timeline Builder

The join logic is entirely generic to "correlate a shop-floor event across a transactional system, an execution system, and a sensor system by asset ID and time" — it is directly reusable by Quality (linking a defect event to the process parameters and production order active at the time) and by Production/OEE analysis (reconstructing what happened around an unplanned stop for schedule-adherence reporting), with no change to the join logic, only to which downstream reasoning skill consumes the timeline.
