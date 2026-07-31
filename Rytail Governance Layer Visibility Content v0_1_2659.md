# Rytail Governance Layer — Visibility Content Model v0.1
*Content spec for the "agent constellation" dashboard, built before the UI. Source: rytail_agent_list.docx, Rytail_Agentic_Architecture.md, Rytail_FirstAllocation_Module_Spec.md, Rytail First Allocation technical document (FA multi-agent architecture), Warehouse-to-Store Reallocation Module.docx.*

---

## 1. What this layer is for

The governance dashboard gives DJ / merchandising leadership / GWC a single visual answer to three questions:
1. **What ran, how often, and did it succeed?** (execution visibility)
2. **What talks to what?** (the correlation network — orchestrator → agent → sub-agent → shared service)
3. **Where are we exposed?** (pilot vs. planned vs. peripheral; human-approval gates; open schema gaps)

This section is the **data model**. Section 6 is the **node/edge schema** the UI will consume. Nothing here fabricates real run counts — those don't exist yet because there's no telemetry store live. Section 7 proposes the minimum event schema needed to populate real numbers; until then, the dashboard should render structure + status, not invented volume figures.

---

## 2. Four-layer hierarchy

```
LAYER 0 — Interaction / Master Orchestration
   └─ Conversation Orchestrator (router)
       └─ Chief Merchandising Orchestrator (cross-stage coherence)

LAYER 1 — Stage Orchestrators (sequence/fan-out domain agents)
   ├─ Pre-Season Planning Orchestrator
   ├─ Allocation Orchestrator
   ├─ In-Season Trading Orchestrator  ★ pilot focus
   ├─ Exit & Markdown Orchestrator
   └─ Weekly Review Orchestrator (cross-cutting, Mon→Tue cadence)

LAYER 2 — Domain Agents (13) — paired 1:1 with a business playbook
   PLAN:      Trend Planning · Assortment · Cannibalization · Size Curve (shared service)
   BUY:       Buy/OTB ★
   ALLOCATE:  First Allocation · Launch Tracker
   TRADE:     Option Performance ★ · Replenishment · Reallocation (WH→Store)
   EXIT:      Slow Mover · EOL & Overstock · Pricing & Elasticity (shared service)

LAYER 3 — Shared Capability Agents (6) — built once, consumed by all
   Demand Forecast · Inventory Optimization · Anomaly/Exception Detection ·
   Data Bridge Agent ⭐ (only path to data) · Narrative & Insight · Action & Workflow

LAYER 3.5 — Sub-agents / components (inside a domain agent, per-module)
   Example — First Allocation Agent decomposes into 6 execution units:
     1. Comparable Data Agent      → FA-COMP-01 (gated intake) + FA-SCORE-01 (scoring)
     2. Store Scoring & Suggestion Agent
     3. SKU Cannibalization Agent (read-only, advisory)
     4. Occasion Agent
     5. Store Scoring & Calculation Agent → SA-CALC-01 + SA-CONF-01
     6. Size Curve Agent → Half 1 (Domo ETL, scheduled) + Half 2 (Claude-managed, per-request)
   (Same decomposition pattern is expected for Reallocation/WTS and Option Performance
   once their technical docs are written at this granularity — currently only FA has it.)

LAYER 4 — Peripheral / Future Agents (7) — not in pilot scope
   Supplier Catalog · Workforce/Roster · Trial Rejection Feedback ·
   Review Sentiment · Waste Pattern · Cart Abandonment · Network Optimization
```

**Total cataloged nodes: 33 top-level agents/orchestrators** + FA's 6 sub-agent decompositions (2 of which split into 2 execution halves each) = **~41 addressable nodes** once FA is fully expanded. Other modules will add more sub-agent nodes as their technical docs reach FA's level of detail.

---

## 3. Full inventory table

**Status legend:** 🟢 Pilot/Live · 🟡 Spec'd, not built · ⚪ Peripheral/Future

| ID | Name | Layer | Stage/Module | Parent | Status |
|---|---|---|---|---|---|
| ORC-00 | Conversation Orchestrator | L0 | Interaction | — | 🟡 |
| ORC-01 | Chief Merchandising Orchestrator | L0 | Cross-stage | ORC-00 | 🟡 |
| ORC-02 | Pre-Season Planning Orchestrator | L1 | Plan | ORC-01 | 🟡 |
| ORC-03 | Allocation Orchestrator | L1 | Allocate & Launch | ORC-01 | 🟡 |
| ORC-04 | In-Season Trading Orchestrator | L1 | Trade | ORC-01 | 🟢 pilot |
| ORC-05 | Exit & Markdown Orchestrator | L1 | Exit | ORC-01 | 🟡 |
| ORC-06 | Weekly Review Orchestrator | L1 | Cross-cutting | ORC-01 | 🟡 |
| AG-01 | Trend Planning Agent | L2 | Plan | ORC-02 | 🟡 |
| AG-02 | Assortment Agent | L2 | Plan | ORC-02 | 🟡 |
| AG-03 | Cannibalization Agent | L2 | Plan | ORC-02 | 🟡 |
| AG-04 | Size Curve Agent (shared service) | L2/L3 | Plan / cross-module | ORC-02, ORC-03, AG-08, AG-11, AG-12 | 🟡 |
| AG-05 | Buy/OTB Agent ★ | L2 | Buy | ORC-02 | 🟡 |
| AG-06 | First Allocation Agent | L2 | Allocate & Launch | ORC-03 | 🟢 spec'd, building |
| AG-07 | Launch Tracker Agent | L2 | Allocate & Launch | ORC-03 | 🟡 |
| AG-08 | Option Performance Agent ★ | L2 | Trade | ORC-04 | 🟢 pilot |
| AG-09 | Replenishment Agent | L2 | Trade | ORC-04 | 🟡 |
| AG-10 | Reallocation Agent (WH→Store) | L2 | Trade | ORC-04 | 🟡 spec'd (WTS doc) |
| AG-11 | Slow Mover Agent | L2 | Exit | ORC-05 | 🟡 |
| AG-12 | EOL & Overstock Agent | L2 | Exit | ORC-05 | 🟡 |
| AG-13 | Pricing & Elasticity Agent (shared service) | L2/L3 | Exit / cross-module | ORC-05, AG-08, AG-11, AG-12 | 🟡 |
| SH-01 | Demand Forecast Agent | L3 | Shared | consumed by nearly all L2 | 🟡 |
| SH-02 | Inventory Optimization Agent | L3 | Shared | AG-06, AG-09, AG-10, AG-08, AG-11 | 🟡 |
| SH-03 | Anomaly / Exception Detection Agent | L3 | Shared | AG-08, AG-05, monitoring agents | 🟡 |
| SH-04 | Data Bridge Agent ⭐ | L3 | Shared — only path to data | ALL agents | 🟢 build priority #1 |
| SH-05 | Narrative & Insight Agent | L3 | Shared | all orchestrators, pre-output | 🟡 |
| SH-06 | Action & Workflow Agent | L3 | Shared | all orchestrators, post-approval | 🟡 |
| PER-01 | Supplier Catalog Agent | L4 | Peripheral | — | ⚪ |
| PER-02 | Workforce/Roster Agent | L4 | Peripheral | — | ⚪ |
| PER-03 | Trial Rejection Feedback Agent | L4 | Peripheral | AG-07 (as *why*-source) | ⚪ |
| PER-04 | Review Sentiment Agent | L4 | Peripheral | — | ⚪ |
| PER-05 | Waste Pattern Agent | L4 | Peripheral | — | ⚪ |
| PER-06 | Cart Abandonment Agent | L4 | Peripheral | — | ⚪ |
| PER-07 | Network Optimization Agent | L4 | Peripheral | — | ⚪ |

### 3a. First Allocation sub-agent decomposition (AG-06 children — the deepest-modeled node)

| Sub-ID | Name | Parent | Trigger condition | Read/Write mode |
|---|---|---|---|---|
| FA-01 | Comparable Data Agent → FA-COMP-01 (Gated Intake) | AG-06 | SKU batch staged | Gated, ask_user loop |
| FA-01b | Comparable Data Agent → FA-SCORE-01 (Comparable Scoring) | FA-01 | Comparable set confirmed | Deterministic SQL scoring |
| FA-02 | Store Scoring & Suggestion Agent | AG-06 | Comparable SKUs exist + launch plan uploaded | Recommends top 3–5 stores |
| FA-03 | SKU Cannibalization Agent | AG-06 | Store Code + new SKU Product Code known | Read-only, advisory |
| FA-04 | Occasion Agent | AG-06 | Store ID + upcoming date range known | Calls get_google_holidays, query_dataset |
| FA-05 | Store Scoring & Calculation Agent → SA-CALC-01 | AG-06 | Candidate stores + warehouses selected | Deterministic allocation math |
| FA-05b | Store Scoring & Calculation Agent → SA-CONF-01 | FA-05 | After SA-CALC-01 | Confidence scoring |
| FA-06 | Size Curve Agent → Half 1 (Domo ETL, scheduled) | AG-04 | Scheduled cadence | Builds size lookup table |
| FA-06b | Size Curve Agent → Half 2 (Claude-managed, per-request) | AG-04 | Store-level unit allocation exists | Per-request size split |

---

## 4. Network / correlation map (edges for the graph)

Format: `SOURCE —[relationship]→ TARGET`

**Routing / sequencing (orchestration layer)**
- ORC-00 —routes→ ORC-01 or directly to a single L2 agent (simple query bypass)
- ORC-01 —sequences→ ORC-02, ORC-03, ORC-04, ORC-05 (cross-stage reconciliation)
- ORC-02 —pipeline→ AG-01 → AG-02 → AG-03 → AG-05 → AG-04 (sequential, contract-passed)
- ORC-03 —sequences→ AG-06 → AG-04, sets up AG-07
- ORC-04 —coordinates→ AG-08, AG-09, AG-10, AG-13 (high-frequency loop)
- ORC-05 —coordinates→ AG-11, AG-12, AG-13
- ORC-06 —fans out→ all L2 agents' playbooks weekly, aggregates, ranks, hands off to SH-06

**Domain agent → shared service calls**
- AG-06 —calls→ SH-01 (Step 2 comparables), AG-04 (Step 5), SH-02 (Step 3 eviction), SH-03 (Step 3 eviction)
- AG-08 —calls→ SH-03, SH-02, AG-13 (Poor-rated reprice), AG-10 (consolidate), SH-05
- AG-09 —calls→ SH-01, SH-02, AG-04
- AG-10 —calls→ SH-01, SH-02, AG-04
- AG-05 —calls→ SH-01
- AG-11 —calls→ AG-13, AG-10
- AG-12 —calls→ AG-13
- AG-07 —calls→ AG-08, PER-03

**Everything → Data Bridge (the hub node)**
- ALL L2 + L3 agents —query via→ SH-04 (no agent talks to a warehouse directly)

**Post-decision fan-out**
- AG-06 (on approval) —notifies→ AG-09, Observability Store, SH-06
- AG-08 —emits exceptions to→ SH-05 → SH-06 → owner/SLA

**Human-in-the-loop gates** (render as a distinct edge style — e.g. dashed gold — since this is the governance-relevant boundary)
- AG-06 → WMS/ERP write-back: **gated**
- AG-10 → WMS/ERP write-back: **gated**
- AG-12/AG-13 → markdown execution: **gated**
- SH-06 → any side-effect: **gated**

This gate set is itself a first-class thing to surface on the dashboard — it's the answer to "what can an agent do without a human," which is exactly the governance question.

---

## 5. Node categories for the radial layout (mirrors the reference image's 6–8 cluster ring)

Mapping Rytail's lifecycle + architecture onto the image's radial-cluster pattern:

| Cluster (ring position) | Contents | Icon suggestion |
|---|---|---|
| PLAN | AG-01, AG-02, AG-03, AG-04 | seedling / grid |
| BUY | AG-05 | cart |
| ALLOCATE & LAUNCH | AG-06 (+ FA-01…FA-06b), AG-07 | shipping box |
| TRADE | AG-08, AG-09, AG-10 | trending-up arrow |
| EXIT | AG-11, AG-12, AG-13 | archive |
| ORCHESTRATION (center core, not a ring — like the dust-cloud center in the image) | ORC-00…ORC-06 | hub/star |
| SHARED SERVICES | SH-01…SH-06, with SH-04 visually emphasized as the largest/brightest node | link/bridge |
| PERIPHERAL (outer, dimmer ring) | PER-01…PER-07 | dotted outline, low-opacity |

Each cluster gets one anchor "hub" node (colored ring, like OPERATIONS/INTELLIGENCE in the reference) with child nodes branching outward on connector lines — small hollow-circle nodes for not-yet-built items (matching the faint unfilled dots in the reference image), filled bright nodes for pilot/live agents.

---

## 6. Node & edge JSON schema (what the UI will actually consume)

```json
{
  "nodes": [
    {
      "id": "AG-06",
      "label": "First Allocation Agent",
      "layer": "L2",
      "cluster": "ALLOCATE_LAUNCH",
      "status": "pilot_building",
      "parent": "ORC-03",
      "playbook": "FA Allocation",
      "children": ["FA-01","FA-02","FA-03","FA-04","FA-05","FA-06"],
      "run_stats": {
        "total_runs": null,
        "runs_last_7d": null,
        "success_rate": null,
        "avg_confidence_score": null,
        "last_run_at": null
      },
      "human_gate": true
    }
  ],
  "edges": [
    { "source": "AG-06", "target": "SH-04", "type": "data_query" },
    { "source": "AG-06", "target": "AG-04", "type": "sub_service_call" },
    { "source": "AG-06", "target": "SH-06", "type": "notify_on_approval", "gated": true }
  ]
}
```

`run_stats` fields are intentionally `null` — see Section 7. The dashboard should render "no telemetry yet" rather than a fake zero or placeholder number, so the visualization doesn't imply data that doesn't exist.

---

## 7. Telemetry event schema (needed before "times ran" can be real)

No execution logging exists yet. To light up run counts, each agent invocation should emit one event:

| Field | Example |
|---|---|
| `run_id` | uuid |
| `agent_id` | `AG-06` or `FA-05b` for sub-agent granularity |
| `orchestrator_id` | `ORC-03` (who triggered it) |
| `trigger_type` | `scheduled` / `on_demand` / `chained` |
| `triggered_by_run_id` | parent run, for chain reconstruction |
| `tenant_id` | for multi-tenant SaaS rollup |
| `started_at` / `completed_at` | |
| `status` | `success` / `failed` / `awaiting_human_approval` |
| `confidence_output` | if applicable (0–100) |
| `downstream_calls` | list of agent_ids invoked during this run |
| `human_gate_hit` | bool |
| `human_decision` | `approved` / `rejected` / `adjusted` / `pending` |

This is a natural fit for the Action & Workflow Agent (SH-06) plus a lightweight run-log table the Data Bridge writes to on every agent invocation — it doesn't need a new system, just a consistent emit point.

---

## 8. Open items before UI build

1. **Confirm cluster set** — 8 clusters above (Plan/Buy/Allocate/Trade/Exit/Orchestration/Shared/Peripheral), or collapse to 6 to match the reference image's layout more closely (e.g. fold Peripheral into a footnote panel rather than a ring)?
2. **Confirm whether sub-agent nodes (FA-01…FA-06b) render by default or only on cluster expand/zoom** — 41 nodes at once will be dense; the reference image handles this with a zoom control.
3. **Confirm status taxonomy** — 🟢🟡⚪ above, or a 4-state (Live / Pilot / Spec'd / Peripheral)?
4. **Decide "times ran" placeholder behavior** until telemetry exists — recommend the node shows "Not yet instrumented" rather than 0, per Section 6.

Once these are confirmed, next step is the HTML/React radial-graph UI in the reference image's visual style (dark background, glowing hub nodes, thin connector lines, category labels, zoom controls, hollow dots for unbuilt nodes).
