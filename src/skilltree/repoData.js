// The Manufacturing department is backed by a real folder — src/Manufacturing — rather than the
// hand-authored branch/agent data the other six departments use. This module turns that folder
// into a tree the canvas can walk, and lays each opened level out radially.
//
// The file list comes from import.meta.glob, so it is resolved at build time from whatever is
// actually on disk: add or rename a folder under src/Manufacturing and the tree follows with no
// code change. Contents are lazy (`{ import: 'default' }` without `eager`), so the bundle carries
// the paths up front and fetches a file's text only when it is opened or zipped.

const RAW = {
  ...import.meta.glob('../Manufacturing/**/*.md', { query: '?raw', import: 'default' }),
  ...import.meta.glob('../Manufacturing/**/*.json', { query: '?raw', import: 'default' }),
  ...import.meta.glob('../Manufacturing/**/*.csv', { query: '?raw', import: 'default' }),
  // Dot-prefixed paths need naming literally: glob's `*` does not match a leading dot, so
  // .claude-plugin/ and .mcp.json would be invisible to the patterns above.
  ...import.meta.glob('../Manufacturing/**/.claude-plugin/*.json', { query: '?raw', import: 'default' }),
  ...import.meta.glob('../Manufacturing/**/.mcp.json', { query: '?raw', import: 'default' }),
}

const PREFIX = '../Manufacturing/'

// --- folder icons ------------------------------------------------------------------------------
// A folder node shows the icon of the thing it holds, so a connector folder carries that product's
// own mark: microsoft-teams gets the Teams glyph, sap-pm the SAP badge, and so on. Matched on the
// lowercased folder name, so the folder name on disk is the only thing that decides the icon —
// adding a connector folder is enough to give it one.
const FOLDER_ICON_EXACT = {
  // structural folders
  connectors: 'facetConnectors',
  skills: 'facetSkills',
  plugin: 'gear',
  plugins: 'gear',
  '.claude-plugin': 'gear',
  'sample data': 'chart',
  templates: 'doc',
  prompts: 'facetSkills',

  // connectors, by product / system
  'microsoft-teams': 'connTeams',
  'microsoft_teams': 'connTeams',
  teams: 'connTeams',
  outlook: 'connOutlook',
  'outlook-calendar': 'connCalendar',
  'outlook_calendar': 'connCalendar',
  calendar: 'connCalendar',
  sharepoint: 'connSharePoint',
  'sap-pm': 'connSap',
  'sap_pm': 'connSap',
  'sap-mm': 'connSap',
  'sap_mm': 'connSap',
  sap: 'connSap',
  erp: 'connErp',
  mes: 'connMes',
  'opc-ua-plc': 'connPlc',
  'opc_ua_plc': 'connPlc',
  'opc-ua': 'connPlc',
  'opc_ua': 'connPlc',
  plc: 'connPlc',
  'sql-database': 'databaseMining',
  'sql_database': 'databaseMining',
  sql: 'databaseMining',
  'historian-database': 'connHistorian',
  'historian_database': 'connHistorian',
  historian: 'connHistorian',
  'inventory-database': 'connInventoryDb',
  'inventory_database': 'connInventoryDb',
  inventory: 'connInventoryDb',
  'supplier-portal': 'connSupplier',
  'supplier_portal': 'connSupplier',
  supplier: 'connSupplier',
  vendor: 'connSupplier',
}

// Fallbacks for folders with no exact entry — first match wins. This is what gives the Skills
// folders (fault-diagnosis, work-order-generator, ...) something better than a blank folder, and
// means a newly added connector still lands on a sensible glyph before anyone extends the table.
const FOLDER_ICON_RULES = [
  [/teams|chat|slack/, 'connTeams'],
  [/outlook|mail|email/, 'connOutlook'],
  [/calendar|schedul/, 'connCalendar'],
  [/sharepoint|portal/, 'connSharePoint'],
  [/sap/, 'connSap'],
  [/erp/, 'connErp'],
  [/mes|production|shop-floor/, 'connMes'],
  [/plc|opc|sensor|scada/, 'connPlc'],
  [/histor/, 'connHistorian'],
  [/inventory|spare|stock|part/, 'connInventoryDb'],
  [/supplier|vendor|procure/, 'connSupplier'],
  [/database|sql|warehouse/, 'databaseMining'],
  // skills and everything else, by what the name is about
  [/predict/, 'clock'],
  [/analy|diagnos|rca|root-cause|search|retriev/, 'search'],
  [/plan|resource/, 'compass'],
  [/report|summar|document|writer|guide/, 'doc'],
  [/generat|recommend/, 'spark'],
  [/checklist|valid|complian/, 'check'],
  [/cost|optimi|forecast/, 'chart'],
  [/voice|call/, 'phone'],
  [/timeline|shift|time/, 'clock'],
  [/pattern|match|fault/, 'target'],
  [/knowledge|library|book/, 'book'],
  [/work-order|order|task/, 'briefcase'],
  [/safety|risk|shield/, 'shield'],
]

function folderIcon(name) {
  const key = name.toLowerCase()
  if (FOLDER_ICON_EXACT[key]) return FOLDER_ICON_EXACT[key]
  for (const [re, icon] of FOLDER_ICON_RULES) if (re.test(key)) return icon
  return 'folder'
}

const FILE_ICONS = { md: 'doc', json: 'fileJson', csv: 'chart' }

function extOf(name) {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

function newDir(name, path) {
  return { type: 'dir', name, path, icon: folderIcon(name), dirs: [], files: [] }
}

// One pass over the glob keys builds the whole tree: split the relative path, walk/create the
// directory chain, then hang the file off the last one.
const ROOT = (() => {
  const root = newDir('Manufacturing', '')
  for (const key of Object.keys(RAW)) {
    const rel = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key
    const parts = rel.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i]
      let next = node.dirs.find((d) => d.name === name)
      if (!next) {
        next = newDir(name, parts.slice(0, i + 1).join('/'))
        node.dirs.push(next)
      }
      node = next
    }
    const name = parts[parts.length - 1]
    const ext = extOf(name)
    node.files.push({
      type: 'file',
      name,
      path: rel,
      ext,
      icon: FILE_ICONS[ext] || 'doc',
      load: RAW[key],
    })
  }
  // Sort every level so the tree renders in a stable, readable order rather than glob order.
  const sortDeep = (d) => {
    d.dirs.sort((a, b) => a.name.localeCompare(b.name))
    d.files.sort((a, b) => a.name.localeCompare(b.name))
    d.dirs.forEach(sortDeep)
  }
  sortDeep(root)

  const ALLOWED_FOLDERS = new Set(['connectors', 'plugin', 'plugins', 'skills'])
  const ALLOWED_FILES = new Set(['business process', 'implementation guide', 'technical design'])

  // Filter assistant folder children so only Connectors, Plugin, Skills folders and
  // Business Process, Implementation Guide, Technical Design files are shown.
  root.dirs.forEach((assistantDir) => {
    assistantDir.dirs = assistantDir.dirs.filter((d) => ALLOWED_FOLDERS.has(d.name.toLowerCase()))
    assistantDir.files = assistantDir.files.filter((f) => {
      const baseName = f.name.replace(/\.[^/.]+$/, '').toLowerCase()
      return ALLOWED_FILES.has(baseName)
    })
  })

  return root
})()

export const MANUFACTURING_ROOT = ROOT

// Children of a folder, folders first — a folder opens the tree further, a file opens the sidebar,
// and putting the openable ones first keeps that distinction legible on the canvas.
export function childrenOf(dir) {
  if (!dir) return []
  if (collectJsonFiles(dir).length > 0) return []
  return dir.dirs || []
}

// Walk a '/'-joined path back to its node. Returns null for a path that no longer exists, which is
// what makes stale state (an open path from a previous build) fail safe instead of throwing.
export function nodeAt(path) {
  if (!path) return ROOT
  let node = ROOT
  for (const part of path.split('/')) {
    const next = node.dirs.find((d) => d.name === part) || node.files.find((f) => f.name === part)
    if (!next) return null
    node = next
  }
  return node
}

export function loadText(file) {
  return file.load()
}

export function collectJsonFiles(node) {
  if (!node || node.type !== 'dir') return []
  let results = []

  // 1. Direct .json files in this folder
  for (const f of node.files || []) {
    if (f.ext === 'json') {
      results.push({
        file: f,
        folderName: node.name,
        downloadName: f.name,
      })
    }
  }

  // 2. Special exception for Plugin / plugins parent folder: also include .claude-plugin subfolder's json files
  const nameLower = node.name.toLowerCase()
  if (nameLower === 'plugin' || nameLower === 'plugins') {
    for (const sub of node.dirs || []) {
      const subLower = sub.name.toLowerCase()
      if (subLower === '.claude-plugin' || subLower === '.claude-plugins' || subLower === 'claude-plugin') {
        for (const f of sub.files || []) {
          if (f.ext === 'json') {
            results.push({
              file: f,
              folderName: sub.name,
              downloadName: f.name,
            })
          }
        }
      }
    }
  }

  return results
}

export function countJson(dir) {
  if (!dir || dir.type !== 'dir') return 0
  return collectJsonFiles(dir).length
}

export async function jsonBundle(dir) {
  if (!dir || dir.type !== 'dir') return []
  const items = collectJsonFiles(dir)
  const texts = await Promise.all(items.map((item) => item.file.load()))
  return items.map((item, i) => {
    return { name: item.file.name, text: texts[i] }
  })
}

// --- layout -----------------------------------------------------------------------------------
// The top-level folders sit on a ring like the other departments' branches. Every opened folder
// then fans its own children outward along its own direction, so the tree keeps growing along the
// branch you walked rather than re-centring.

const RING_RADIUS = 700
// The ring spans the upper arc only, matching the shape the other departments' fans have.
const ARC_FROM = -168
const ARC_TO = -12

// Clear space between adjacent sibling centres. Distance from the parent is derived from this and
// the child count, because a fixed distance either bunches 9 children on top of each other or
// throws 2 children absurdly far out.
const SIBLING_SEP = 560
const SPREAD_MAX = 210
const SPREAD_PER_CHILD = 34

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function fanChildren(parent, angle, count) {
  const spread = Math.min(SPREAD_MAX, SPREAD_PER_CHILD * (count - 1))
  const step = count > 1 ? spread / (count - 1) : 0
  // Arc length needed = SIBLING_SEP * gaps, so radius = that over the angle in radians.
  const dist = count > 1
    ? clamp((SIBLING_SEP * (count - 1)) / ((spread * Math.PI) / 180), 620, 1600)
    : 700
  return Array.from({ length: count }, (_, i) => {
    const a = angle + (((i - (count - 1) / 2) * step * Math.PI) / 180)
    return { left: parent.left + Math.cos(a) * dist, top: parent.top + Math.sin(a) * dist, angle: a }
  })
}

// openPath: array of folder names from the root down, e.g.
// ['01-Predictive-Maintenance-Assistant', 'Connectors', 'outlook'].
// Returns every node to draw, with the edges between them, plus the frame the view should hold.
export function layoutRepo(openPath) {
  const nodes = []
  const edges = []

  const top = childrenOf(ROOT)
  const step = top.length > 1 ? (ARC_TO - ARC_FROM) / (top.length - 1) : 0
  top.forEach((child, i) => {
    const a = ((ARC_FROM + step * i) * Math.PI) / 180
    nodes.push({
      node: child,
      path: child.name,
      depth: 0,
      left: Math.cos(a) * RING_RADIUS,
      top: Math.sin(a) * RING_RADIUS,
      angle: a,
      open: openPath[0] === child.name,
    })
    edges.push({ from: { left: 0, top: 0 }, to: nodes[nodes.length - 1], depth: 0, i })
  })

  // Walk the open chain, laying out each open folder's children as we go.
  let parent = nodes.find((n) => n.open)
  let depth = 1
  let focus = parent || null
  while (parent && parent.node.type === 'dir') {
    const kids = childrenOf(parent.node)
    if (!kids.length) break
    const pts = fanChildren(parent, parent.angle, kids.length)
    const laid = kids.map((child, i) => ({
      node: child,
      path: `${parent.path}/${child.name}`,
      depth,
      left: pts[i].left,
      top: pts[i].top,
      angle: pts[i].angle,
      open: openPath[depth] === child.name,
    }))
    laid.forEach((n, i) => {
      nodes.push(n)
      edges.push({ from: parent, to: n, depth, i })
    })
    // The frame follows the deepest level that actually opened, so the newest ring of children is
    // what the view holds.
    focus = { parent, kids: laid }
    parent = laid.find((n) => n.open)
    depth++
  }

  return { nodes, edges, focus }
}
