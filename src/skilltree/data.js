// Department wheel positions, colors and hub icons below are copied verbatim (same px offsets,
// same hex colors, same icon path data) from the SingleFile capture of the live wheel
// (html1.html). Sales' fan layout, node coordinates, icons and the "ICP Definition" card copy
// are copied verbatim from html2.html / html3.html. Everything else (the other 6 departments'
// team/job/card content and their fan-node coordinates) is original placeholder content in the
// same schema, since the captured pages never expanded those departments.

// Wheel positions are computed from each department's index/count below, rather
// than hardcoded per-department, so adding/removing a department here is all
// that's needed to reflow the whole wheel evenly. (Radius matches the original
// verbatim capture: Sales sat at exactly (0, 310).)
const WHEEL_RADIUS = 310

const DEPARTMENTS_BASE = [
  { key: 'sales', name: 'Sales', sub: 'targeting · outreach · sequencing', color: '#FF9D5C', icon: 'deptSales' },
  { key: 'deals', name: 'Deals', sub: 'replies · calls · closing · pipeline', color: '#EF4444', icon: 'deptDeals' },
  { key: 'marketing', name: 'Marketing', sub: 'content · brand · distribution', color: '#A78BFA', icon: 'deptMarketing' },
  { key: 'operations', name: 'Operations', sub: 'onboarding · builds · client ops', color: '#5EEAD4', icon: 'deptOperations' },
  { key: 'intelligence', name: 'Intelligence', sub: 'companies · people · markets', color: '#7DD3FC', icon: 'deptIntelligence' },
  { key: 'customer', name: 'Customer', sub: 'support · success · community', color: '#FB7185', icon: 'deptCustomer' },
  { key: 'backoffice', name: 'Back Office', sub: 'money in · books · office · people', color: '#FACC15', icon: 'deptBackOffice' },
]

export const DEPARTMENTS = DEPARTMENTS_BASE.map((d, i, arr) => {
  const angle = ((90 + (i * 360) / arr.length) * Math.PI) / 180
  return {
    ...d,
    wx: +(Math.cos(angle) * WHEEL_RADIUS).toFixed(1),
    wy: +(Math.sin(angle) * WHEEL_RADIUS).toFixed(1),
  }
})

// --- exact Sales fan, from html2.html / html3.html ---
const salesNodes = [
  { name: 'ICP Definition', left: -398.5, top: -96.5, team: 'Targeting', status: 'deployed', tag: 'START HERE', icon: 'icpDefinition', file: 'icp-strategist.md', skill: 'ICP Strategist' },
  { name: 'Market Mapping', left: -587.0, top: -211.8, team: 'Targeting', status: 'deployed', icon: 'marketMapping', file: 'market-mapper.md', skill: 'Market Mapper' },
  { name: 'Trigger Detection', left: -821.9, top: -163.5, team: 'Targeting', status: 'dev', icon: 'triggerDetection', file: 'buying-signals-analyst.md', skill: 'Buying-Signals Analyst' },
  { name: 'Lookalike Modeling', left: -989.5, top: -357.1, team: 'Targeting', status: 'dev', icon: 'spark', file: 'lead-scoring-analyst.md', skill: 'Lead Scoring Analyst' },

  { name: 'Database Mining', left: -281.2, top: -298.4, team: 'Lead Sourcing', status: 'deployed', icon: 'databaseMining', file: 'lead-sourcing-manager.md', skill: 'Lead Sourcing Manager' },
  { name: 'Web & Maps Scraping', left: -376.1, top: -497.9, team: 'Lead Sourcing', status: 'deployed', icon: 'webScraping', file: 'lead-sourcing-manager.md', skill: 'Lead Sourcing Manager' },
  { name: 'Social Mining', left: -599.4, top: -585.7, team: 'Lead Sourcing', status: 'deployed', icon: 'socialMining', file: 'social-prospecting-specialist.md', skill: 'Social Prospecting Specialist' },
  { name: 'List Building', left: -634.1, top: -839.4, team: 'Lead Sourcing', status: 'deployed', icon: 'listBuilding', file: 'lead-sourcing-manager.md', skill: 'Lead Sourcing Manager' },

  { name: 'Contact Enrichment', left: -72.7, top: -403.5, team: 'Enrichment', status: 'deployed', icon: 'contactEnrichment', file: 'data-enrichment-specialist.md', skill: 'Data Enrichment Specialist' },
  { name: 'Email Verification', left: -43.3, top: -622.5, team: 'Enrichment', status: 'deployed', icon: 'emailVerification', file: 'data-enrichment-specialist.md', skill: 'Data Enrichment Specialist' },
  { name: 'Account Enrichment', left: -182.4, top: -817.9, team: 'Enrichment', status: 'deployed', icon: 'accountEnrichment', file: 'data-enrichment-specialist.md', skill: 'Data Enrichment Specialist' },
  { name: 'Fit Scoring', left: -72.9, top: -1049.5, team: 'Enrichment', status: 'deployed', icon: 'fitScoring', file: 'lead-scoring-analyst.md', skill: 'Lead Scoring Analyst' },

  { name: 'Personalization Research', left: 212.1, top: -350.9, team: 'Outreach Writing', status: 'deployed', icon: 'personalizationResearch', file: 'prospect-research-analyst.md', skill: 'Prospect Research Analyst' },
  { name: 'Cold Email Drafting', left: 378.9, top: -495.8, team: 'Outreach Writing', status: 'deployed', icon: 'coldEmailDrafting', file: 'cold-email-copywriter.md', skill: 'Cold Email Copywriter' },
  { name: 'LinkedIn Messaging', left: 403.6, top: -734.4, team: 'Outreach Writing', status: 'deployed', icon: 'linkedinMessaging', file: 'linkedin-outreach-specialist.md', skill: 'LinkedIn Outreach Specialist' },
  { name: 'Proof Matching', left: 638.8, top: -835.9, team: 'Outreach Writing', status: 'deployed', icon: 'proofMatching', file: 'case-study-curator.md', skill: 'Case Study Curator' },
  { name: 'Cold-Call Scripting', left: 609.8, top: -1109.5, team: 'Outreach Writing', status: 'deployed', icon: 'spark', file: 'outbound-scriptwriter.md', skill: 'Outbound Scriptwriter' },
  { name: 'Video Prospecting', left: 898.7, top: -1175.9, team: 'Outreach Writing', status: 'deployed', icon: 'spark', file: 'outbound-scriptwriter.md', skill: 'Outbound Scriptwriter' },

  { name: 'Campaign Orchestration', left: 391.1, top: -123.1, team: 'Sequencing & Send', status: 'deployed', icon: 'campaignOrchestration', file: 'campaign-operations-manager.md', skill: 'Campaign Operations Manager' },
  { name: 'Campaign Launch', left: 612.0, top: -121.7, team: 'Sequencing & Send', status: 'deployed', icon: 'campaignLaunch', file: 'campaign-operations-manager.md', skill: 'Campaign Operations Manager' },
  { name: 'Deliverability', left: 788.2, top: -284.4, team: 'Sequencing & Send', status: 'dev', icon: 'deliverability', file: 'deliverability-manager.md', skill: 'Deliverability Manager' },
  { name: 'Send Optimization', left: 1031.8, top: -205.2, team: 'Sequencing & Send', status: 'deployed', icon: 'sendOptimization', file: 'campaign-operations-manager.md', skill: 'Campaign Operations Manager' },
]

// Exact, verbatim card copy for ICP Definition (from html3.html). Every other node below
// carries placeholder card content in the same schema (state/desc/skills/ladder/etc.).
const icpDefinitionCard = {
  crumb: 'Sales · Targeting',
  desc: 'Define and refine ideal customer profiles per vertical · firmographics, pain patterns, buying triggers.',
  skills: ['icp-profiler', 'vertical-scorer', 'pain-pattern-library'],
  buildsOn: 'Company Knowledge Base',
  replaces: "The founder's gut feel, applied inconsistently by everyone downstream. Bad ICP wastes every dollar spent after it.",
  ladder: {
    humanLed: 'A slide from 2 years ago that nobody opens.',
    humanAssisted: 'AI drafts ICP profiles per vertical from your closed-won data; a human edits quarterly.',
    fullyAutonomous: "Profiles update themselves as deals close and lose · win patterns feed back in without a meeting.",
  },
  human: 'The founder owns this forever. AI drafts and refreshes; the human decides who the business is for. Never fully delegated.',
  notes: "Start here. This is the first node of the Sales tree for a reason · every job downstream (sourcing, scoring, writing) reads from it. Write one page per vertical: firmographics, the pain in the buyer's words, the trigger that makes them buy now. Store it where your agents can read it, not in a deck.",
  fileDesc: 'The ICP Strategist turns your win/loss history into ideal customer profiles that agents can actually act on.',
}

function placeholderCard(node, dept) {
  return {
    crumb: `${dept.name} · ${node.team}`,
    desc: `${node.name} for ${dept.name.toLowerCase()} · handled end-to-end by the ${node.skill}.`,
    skills: [node.file.replace('.md', ''), `${node.team.toLowerCase().replace(/[^a-z]+/g, '-')}-review`],
    buildsOn: dept.name === 'Sales' ? 'ICP Definition' : 'Company Knowledge Base',
    replaces: `A person doing "${node.name}" by hand, one at a time, from memory or a spreadsheet.`,
    ladder: {
      humanLed: `Someone on the ${dept.name} team does this manually, when they remember to.`,
      humanAssisted: `AI drafts the output of ${node.name.toLowerCase()}; a human reviews before it ships.`,
      fullyAutonomous: `Runs on its own on a schedule or trigger · a human only looks in when something looks off.`,
    },
    human: `A human still owns the exceptions and the judgment calls this job can't make on its own.`,
    notes: `Wire this to real ${dept.name.toLowerCase()} data before trusting its output — it's only as good as what it reads.`,
    fileDesc: `The ${node.skill} handles ${node.name.toLowerCase()} so nobody has to do it by hand.`,
  }
}

function buildSalesFan() {
  const nodes = salesNodes.map((n) => ({
    ...n,
    card: n.name === 'ICP Definition' ? icpDefinitionCard : placeholderCard(n, DEPARTMENTS[0]),
  }))
  const lines = []
  const byTeam = {}
  nodes.forEach((n) => {
    byTeam[n.team] = byTeam[n.team] || []
    byTeam[n.team].push(n)
  })
  Object.values(byTeam).forEach((chain) => {
    // `seg` = this line's (and its destination node's) position along its own
    // chain (0 = leaves the root). All chains start together and draw outward in
    // lockstep, segment by segment — each node popping in right as its own
    // incoming line finishes — rather than every node appearing at once.
    chain[0].seg = 0
    lines.push({ x1: 0, y1: 0, x2: chain[0].left, y2: chain[0].top, seg: 0 })
    for (let i = 1; i < chain.length; i++) {
      chain[i].seg = i
      lines.push({ x1: chain[i - 1].left, y1: chain[i - 1].top, x2: chain[i].left, y2: chain[i].top, seg: i })
    }
  })
  // The real captured label coordinates (salesTeamLabels) sit ~250-300px past the
  // last node — a gap that reads fine at native size but doubles into a much
  // bigger empty stretch once LENGTH_SCALE stretches the whole fan out. Anchor
  // the label to the actual last node's direction/reach instead, with the same
  // fixed gap the placeholder departments use, so Sales matches everyone else.
  const teams = Object.entries(byTeam).map(([name, chain]) => {
    const last = chain[chain.length - 1]
    const angle = Math.atan2(last.top, last.left)
    const radius = Math.hypot(last.left, last.top) + 90
    return { name, left: Math.cos(angle) * radius, top: Math.sin(angle) * radius }
  })
  return { nodes, lines, teams }
}

// --- procedurally generated placeholder fans for the other 6 departments ---
const PLACEHOLDER_TEAMS = {
  deals: [
    { name: 'Qualification', jobs: [['Reply Triage', 'inbox-triage-specialist'], ['Discovery Calls', 'discovery-call-analyst'], ['Budget Qualification', 'deal-qualifier']] },
    { name: 'Demos', jobs: [['Demo Prep', 'demo-specialist'], ['Live Demo Support', 'demo-specialist'], ['Objection Handling', 'objection-handler']] },
    { name: 'Negotiation', jobs: [['Proposal Drafting', 'proposal-writer'], ['Pricing Review', 'deal-desk-analyst'], ['Contract Redlines', 'contract-analyst']] },
    { name: 'Closing', jobs: [['Signature Chasing', 'closing-coordinator'], ['Close Forecasting', 'revenue-forecaster']] },
    { name: 'Pipeline', jobs: [['Pipeline Hygiene', 'pipeline-analyst'], ['Stage Scoring', 'deal-qualifier'], ['Renewal Risk Flags', 'revenue-forecaster']] },
  ],
  marketing: [
    { name: 'Content', jobs: [['Blog Drafting', 'content-writer'], ['SEO Briefs', 'seo-strategist'], ['Case Study Writing', 'case-study-curator']] },
    { name: 'Brand', jobs: [['Brand Voice Guide', 'brand-strategist'], ['Visual Asset Requests', 'brand-designer']] },
    { name: 'Distribution', jobs: [['Social Scheduling', 'social-media-manager'], ['Newsletter Send', 'email-marketer'], ['Paid Ad Copy', 'paid-media-copywriter']] },
    { name: 'Events', jobs: [['Webinar Promo', 'events-marketer'], ['Post-Event Follow-up', 'events-marketer']] },
    { name: 'Analytics', jobs: [['Campaign Reporting', 'marketing-analyst'], ['Attribution Modeling', 'marketing-analyst'], ['A/B Test Reads', 'marketing-analyst']] },
  ],
  operations: [
    { name: 'Onboarding', jobs: [['Kickoff Scheduling', 'onboarding-coordinator'], ['Account Setup', 'onboarding-specialist'], ['Welcome Sequence', 'onboarding-coordinator']] },
    { name: 'Builds', jobs: [['Config Builds', 'implementation-engineer'], ['Integration Setup', 'integration-engineer'], ['QA Pass', 'qa-analyst']] },
    { name: 'Client Ops', jobs: [['Health Check-ins', 'client-ops-manager'], ['Escalation Routing', 'client-ops-manager']] },
    { name: 'Delivery', jobs: [['Milestone Tracking', 'delivery-manager'], ['Handoff Docs', 'delivery-manager'], ['Change Requests', 'delivery-manager']] },
    { name: 'Process', jobs: [['SOP Maintenance', 'ops-analyst'], ['Workflow Audits', 'ops-analyst']] },
  ],
  intelligence: [
    { name: 'Companies', jobs: [['Firmographic Pulls', 'company-data-analyst'], ['News Monitoring', 'signal-scanner'], ['Funding Alerts', 'signal-scanner']] },
    { name: 'People', jobs: [['Org Chart Mapping', 'people-mapper'], ['Job-Change Tracking', 'signal-scanner']] },
    { name: 'Markets', jobs: [['TAM Sizing', 'market-analyst'], ['Competitor Tracking', 'competitive-analyst'], ['Pricing Benchmarks', 'market-analyst']] },
    { name: 'Signals', jobs: [['Buying-Signal Scoring', 'buying-signals-analyst'], ['Intent Data Review', 'buying-signals-analyst']] },
    { name: 'Research', jobs: [['Deep-Dive Reports', 'research-analyst'], ['Vertical Playbooks', 'research-analyst']] },
  ],
  customer: [
    { name: 'Support', jobs: [['Ticket Triage', 'support-triage-agent'], ['First-Response Drafts', 'support-agent'], ['Knowledge Base Updates', 'support-content-writer']] },
    { name: 'Success', jobs: [['QBR Prep', 'customer-success-manager'], ['Health Scoring', 'customer-success-manager'], ['Upsell Flags', 'customer-success-manager']] },
    { name: 'Community', jobs: [['Forum Moderation', 'community-manager'], ['Champion Outreach', 'community-manager']] },
    { name: 'Feedback', jobs: [['NPS Surveys', 'feedback-analyst'], ['Feature Request Triage', 'feedback-analyst']] },
    { name: 'Retention', jobs: [['Churn Risk Alerts', 'retention-analyst'], ['Win-Back Sequences', 'retention-analyst'], ['Save Calls', 'retention-specialist']] },
  ],
  backoffice: [
    { name: 'Money In', jobs: [['Invoicing', 'billing-specialist'], ['Collections Follow-up', 'collections-agent'], ['Payment Recon', 'billing-specialist']] },
    { name: 'Books', jobs: [['Bookkeeping', 'bookkeeper'], ['Expense Coding', 'bookkeeper'], ['Monthly Close', 'accountant']] },
    { name: 'Office', jobs: [['Vendor Management', 'office-manager'], ['Procurement Requests', 'office-manager']] },
    { name: 'People', jobs: [['Payroll Runs', 'payroll-specialist'], ['Benefits Admin', 'hr-generalist'], ['Onboarding Paperwork', 'hr-generalist']] },
    { name: 'Compliance', jobs: [['Policy Tracking', 'compliance-analyst'], ['Audit Prep', 'compliance-analyst']] },
  ],
}

const STATUS_CYCLE = ['deployed', 'deployed', 'dev', 'deployed', 'plan']
const ICON_CYCLE = ['target', 'compass', 'check', 'briefcase', 'mail', 'mega', 'search', 'users', 'gear', 'chart', 'book', 'spark', 'phone', 'video', 'shield', 'clock', 'rocket', 'heart', 'globe', 'doc', 'scale']

// Generic team/job placeholder for any department key added without its own
// PLACEHOLDER_TEAMS entry, so a new department renders a fan immediately —
// add a real entry above (keyed by the department's `key`) for tailored copy.
function defaultTeams(dept) {
  const n = dept.name
  return [
    { name: 'Team A', jobs: [[`${n} Task One`, 'specialist'], [`${n} Task Two`, 'analyst'], [`${n} Task Three`, 'coordinator']] },
    { name: 'Team B', jobs: [[`${n} Task Four`, 'specialist'], [`${n} Task Five`, 'analyst']] },
    { name: 'Team C', jobs: [[`${n} Task Six`, 'specialist'], [`${n} Task Seven`, 'analyst'], [`${n} Task Eight`, 'coordinator']] },
  ]
}

function buildPlaceholderFan(deptKey, dept) {
  const teamDefs = PLACEHOLDER_TEAMS[deptKey] || defaultTeams(dept)
  const nodes = []
  const lines = []
  const teams = []
  let iconIdx = 0
  const teamCount = teamDefs.length
  teamDefs.forEach((teamDef, ti) => {
    // Spread teams across the upper half only (like the real Sales fan, whose
    // branches all sit above the root badge), instead of the full 360° circle.
    const baseAngle = teamCount > 1 ? -175 + (ti / (teamCount - 1)) * 170 : -90
    const rad = (baseAngle * Math.PI) / 180
    let prevX = 0
    let prevY = 0
    let radius = 260
    teamDef.jobs.forEach(([name, file], ji) => {
      radius += 190 + (ji % 2 === 0 ? 20 : -10)
      const jitter = ((ji * 37) % 50) - 25
      const a = rad + (jitter * Math.PI) / 180 / 4
      const x = Math.cos(a) * radius
      const y = Math.sin(a) * radius
      const status = STATUS_CYCLE[(ti + ji) % STATUS_CYCLE.length]
      const icon = ICON_CYCLE[iconIdx % ICON_CYCLE.length]
      iconIdx++
      const node = {
        name,
        left: x,
        top: y,
        team: teamDef.name,
        status,
        icon,
        seg: ji,
        file: `${file}.md`,
        skill: file.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }
      node.card = placeholderCard(node, dept)
      nodes.push(node)
      lines.push({ x1: prevX, y1: prevY, x2: x, y2: y, seg: ji })
      prevX = x
      prevY = y
    })
    const last = teamDef.jobs.length
    const lx = Math.cos(rad) * (radius + 90)
    const ly = Math.sin(rad) * (radius + 90)
    teams.push({ name: teamDef.name, left: lx, top: ly })
    void last
  })
  return { nodes, lines, teams }
}

// Stretches every node/line/team-label radially outward from the root by this
// factor, so edges read as longer without touching their stroke width.
const LENGTH_SCALE = 1.8

function scaleFan(fan) {
  return {
    nodes: fan.nodes.map((n) => ({ ...n, left: n.left * LENGTH_SCALE, top: n.top * LENGTH_SCALE })),
    lines: fan.lines.map((l) => ({ ...l, x1: l.x1 * LENGTH_SCALE, y1: l.y1 * LENGTH_SCALE, x2: l.x2 * LENGTH_SCALE, y2: l.y2 * LENGTH_SCALE })),
    teams: fan.teams.map((t) => ({ ...t, left: t.left * LENGTH_SCALE, top: t.top * LENGTH_SCALE })),
  }
}

const FAN_CACHE = {}
export function getFan(deptKey) {
  if (FAN_CACHE[deptKey]) return FAN_CACHE[deptKey]
  const dept = DEPARTMENTS.find((d) => d.key === deptKey)
  const fan = deptKey === 'sales' ? buildSalesFan() : buildPlaceholderFan(deptKey, dept)
  const scaled = scaleFan(fan)
  FAN_CACHE[deptKey] = scaled
  return scaled
}

export function deptTotals(deptKey) {
  const fan = getFan(deptKey)
  const live = fan.nodes.filter((n) => n.status === 'deployed').length
  return { live, total: fan.nodes.length }
}
