import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BG, DEPARTMENTS, WHEEL_RADIUS, getBranches } from './data.js'
import { svgIcon } from './icons.js'
import { WHEEL_LABEL_OFFSET, getWheelTree } from './wheelData.js'
import { RepoFan, RepoSidebar } from './RepoTree.jsx'
import { collectJsonFiles, layoutRepo } from './repoData.js'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../lib/utils.js'
import './SkillTree.css'

// Manufacturing's details view is driven by the real src/Manufacturing folder (see repoData.js)
// instead of the hand-authored branch/agent data every other department uses. Matched on name, not
// key, so it survives the key being renamed. The other six are untouched.
const MFG_KEY = DEPARTMENTS.find((d) => d.name === 'Manufacturing')?.key
const ZOOM_MIN = 0.4
const ZOOM_MAX = 3
const ZOOM_STEP = 0.2
const DEPT_STEP = 360 / DEPARTMENTS.length

const DEPT_BADGE_SIZE = 144

const TOPBAR_H = 110
const CHEVRON_TOP = 0.915

function wheelBand(h) {
  const bottom = h * CHEVRON_TOP
  return { centre: (TOPBAR_H + bottom) / 2, room: (bottom - TOPBAR_H) / 2 }
}

const LABEL_HALF_H = 66
const LABEL_HALF_W = 330
const WHEEL_WORLD_V = WHEEL_RADIUS + WHEEL_LABEL_OFFSET + LABEL_HALF_H
const WHEEL_WORLD_H = WHEEL_RADIUS + WHEEL_LABEL_OFFSET + LABEL_HALF_W

function fitWheelScale(w, h) {
  const fit = Math.min(wheelBand(h).room / WHEEL_WORLD_V, (w * 0.5 - 16) / WHEEL_WORLD_H)
  // Floor low enough that a small window fits the whole wheel rather than clipping it.
  return Math.max(0.2, Math.min(0.62, fit))
}

const AGENT_DIST = 620
const FACET_DIST = 620
const FACET_SPREAD = 58

const AGENT_FACETS = [
  { key: 'skills', label: 'Skills', icon: 'facetSkills' },
  { key: 'connectors', label: 'Connectors', icon: 'facetConnectors' },
  { key: 'artifacts', label: 'Artifacts', icon: 'facetArtifacts' },
]

const SIDEBAR_W = 400

const DETAIL_ZOOM = { branches: 0.38, branchOpen: 0.34, agentOpen: 0.28 }

const DETAIL_CENTRE_Y = 390

function fanOut(origin, dirAngle, count, dist, spreadDeg) {
  return Array.from({ length: count }, (_, i) => {
    const a = dirAngle + (((i - (count - 1) / 2) * spreadDeg * Math.PI) / 180)
    return { left: origin.left + Math.cos(a) * dist, top: origin.top + Math.sin(a) * dist }
  })
}

function buildGrowth(branch, agentOpen) {
  if (!branch) return null
  // One agent, so it sits dead ahead on the branch's own angle rather than being fanned.
  const agent = {
    ...branch.agent,
    left: branch.left + Math.cos(branch.angle) * AGENT_DIST,
    top: branch.top + Math.sin(branch.angle) * AGENT_DIST,
  }
  const facets = agentOpen
    ? fanOut(agent, branch.angle, AGENT_FACETS.length, FACET_DIST, FACET_SPREAD)
      .map((p, i) => ({ ...AGENT_FACETS[i], ...p, count: agent[AGENT_FACETS[i].key].length }))
    : null
  return { branch, agent, facets }
}

function normalizeDelta(delta) {
  // Keep an angle delta in (-180, 180] so drag rotation never jumps when the
  // pointer angle wraps across the ±180° seam.
  let d = delta % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export default function SkillTree() {
  const [view, setView] = useState('wheel')
  const [deptKey, setDeptKey] = useState('sales')
  // The three drill-down levels on the canvas: which branch is open (by key), whether its agent
  // is open, and which of the agent's three facets is showing in the sidebar. Each level clears
  // the ones below it.
  const [selected, setSelected] = useState(null)
  const [agentOpen, setAgentOpen] = useState(false)
  const [facetKey, setFacetKey] = useState(null)
  // Manufacturing only: the chain of open folders, and which node's sidebar is showing. Held as a
  // path of names rather than node objects so it stays valid across rebuilds of the folder tree.
  const [repoPath, setRepoPath] = useState([])
  const [repoSidebar, setRepoSidebar] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [wheelRotation, setWheelRotation] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [entering, setEntering] = useState(false)
  const [pendingDeptKey, setPendingDeptKey] = useState(null)
  const [fanSlide, setFanSlide] = useState({ x: 0, scale: 1, opacity: 1, animate: true })
  const [branchesRevealed, setBranchesRevealed] = useState(true)
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, panX: 0, panY: 0, lastAngle: 0, rotationStart: 0 })
  const enterTimerRef = useRef(null)
  const slideTimerRef = useRef(null)
  const revealTimerRef = useRef(null)

  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const wheelScale = fitWheelScale(viewport.w, viewport.h)
  const wheelHubY = wheelBand(viewport.h).centre

  useEffect(() => () => {
    clearTimeout(enterTimerRef.current)
    clearTimeout(slideTimerRef.current)
    clearTimeout(revealTimerRef.current)
  }, [])

  const panResetKey = `${view}|${deptKey}|${selected ? selected.name : ''}`
  const [prevPanKey, setPrevPanKey] = useState(panResetKey)
  if (prevPanKey !== panResetKey) {
    setPrevPanKey(panResetKey)
    if (pan.x !== 0 || pan.y !== 0) setPan({ x: 0, y: 0 })
  }

  function hubScreenCenter() {

    return { x: viewport.w * 0.5, y: wheelHubY }
  }

  function onWorldPointerDown(e) {
    if (e.target.closest('button, textarea, a, input, .st-side, .st-zip-bar')) return
    if (view === 'wheel') {
      const c = hubScreenCenter()
      const angle = (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI
      dragRef.current = { active: true, moved: false, lastAngle: angle, rotationStart: wheelRotation }
    } else {
      dragRef.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onWorldPointerMove(e) {
    if (!dragRef.current.active) return
    if (view === 'wheel') {
      const c = hubScreenCenter()
      const angle = (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI
      const delta = normalizeDelta(angle - dragRef.current.lastAngle)
      if (!dragRef.current.moved && Math.abs(delta) > 0.5) {
        dragRef.current.moved = true
        setDragging(true)
      }
      if (dragRef.current.moved) {
        dragRef.current.lastAngle = angle
        setWheelRotation((r) => r + delta)
      }
      return
    }
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (!dragRef.current.moved && Math.hypot(dx, dy) > 3) {
      dragRef.current.moved = true
      setDragging(true)
    }
    if (dragRef.current.moved) {
      setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy })
    }
  }
  function onWorldPointerUp() {
    dragRef.current.active = false
    setDragging(false)
  }

  function rotatePrev() {
    setWheelRotation((r) => r + DEPT_STEP)
  }
  function rotateNext() {
    setWheelRotation((r) => r - DEPT_STEP)
  }

  function zoomIn() {
    setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
  }
  function zoomOut() {
    setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
  }
  function zoomReset() {
    setZoom(1)
  }

  const dept = DEPARTMENTS.find((d) => d.key === deptKey)
  const isMfg = deptKey === MFG_KEY
  // Laid out here rather than inside RepoFan because the framing below needs the same geometry to
  // decide what to hold in view.
  const repoLayout = useMemo(() => (isMfg ? layoutRepo(repoPath) : null), [isMfg, repoPath])

  // A folder click walks the open chain to that depth; clicking the already-open folder collapses
  // back to its parent. If the node (file or folder) contains files, open the sidebar popup.
  function pickRepoNode(n) {
    if (n.node.type === 'file') {
      setRepoSidebar(n.path)
      return
    }
    const alreadyOpen = repoPath[n.depth] === n.node.name
    setRepoPath(alreadyOpen ? repoPath.slice(0, n.depth) : [...repoPath.slice(0, n.depth), n.node.name])

    const mdFiles = (n.node.files || []).filter((f) => f.ext === 'md')
    const jsonItems = collectJsonFiles(n.node)
    if (mdFiles.length > 0 || jsonItems.length > 0) {
      setRepoSidebar(n.path)
    } else {
      setRepoSidebar(null)
    }
  }
  function collapseRepo() {
    setRepoPath([])
    setRepoSidebar(null)
  }

  const branches = useMemo(() => getBranches(deptKey), [deptKey])
  const branch = selected ? branches.find((b) => b.key === selected) : null
  const growth = useMemo(() => buildGrowth(branch, agentOpen), [branch, agentOpen])
  const openFacet = growth && growth.facets && facetKey
    ? growth.facets.find((f) => f.key === facetKey)
    : null

  // Clicking an open node again collapses that level, so the tree can be walked back in without
  // reaching for a close button.
  function pickBranch(key) {
    setAgentOpen(false)
    setFacetKey(null)
    setSelected(key === selected ? null : key)
  }
  function toggleAgent() {
    setFacetKey(null)
    setAgentOpen((v) => !v)
  }
  function pickFacet(key) {
    setFacetKey(key === facetKey ? null : key)
  }
  function collapseAll() {
    setSelected(null)
    setAgentOpen(false)
    setFacetKey(null)
  }
  const deptIdx = DEPARTMENTS.findIndex((d) => d.key === deptKey)
  const prevDept = DEPARTMENTS[(deptIdx - 1 + DEPARTMENTS.length) % DEPARTMENTS.length]
  const nextDept = DEPARTMENTS[(deptIdx + 1) % DEPARTMENTS.length]

  function openDept(key) {

    if (entering) return
    setEntering(true)
    setBranchesRevealed(false)
    setPendingDeptKey(key)
    setWheelRotation((r) => r + 180)
    enterTimerRef.current = setTimeout(() => {
      // Rotation has settled — pause here for 3s before zooming into the details.
      enterTimerRef.current = setTimeout(() => {
        setDeptKey(key)
        setSelected(null)
        collapseRepo()
        setView('fan')
        setPendingDeptKey(null)
        setFanSlide({ x: 0, scale: 1, opacity: 1, animate: false })
        revealTimerRef.current = setTimeout(() => {
          setBranchesRevealed(true)
          setEntering(false)
        }, 300) // the root badge is already at rest; hold the branches for a beat before drawing them in
      }, 300)
    }, 900) // matches .st-wheel-ring's 0.95s transition, plus a small buffer
  }

  function navigateDept(key, dir) {

    if (entering) return
    setEntering(true)
    setBranchesRevealed(false)
    setFanSlide({ x: 0, scale: 0.7, opacity: 0, animate: true })
    slideTimerRef.current = setTimeout(() => {
      setDeptKey(key)
      setSelected(null)
      collapseRepo()
      setFanSlide({ x: dir * 100, scale: 0.7, opacity: 0, animate: false })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFanSlide({ x: 0, scale: 1, opacity: 1, animate: true })
          slideTimerRef.current = setTimeout(() => {
            revealTimerRef.current = setTimeout(() => {
              setBranchesRevealed(true)
              setEntering(false)
            }, 300)
          }, 480)
        })
      })
    }, 480)
  }

  function backToWheel() {
    setSelected(null)
    collapseRepo()
    setView('wheel')
  }

  let tx, ty, baseScale
  if (view === 'wheel') {
    tx = 0

    ty = wheelHubY - viewport.h * 0.56
    baseScale = wheelScale
  } else if (isMfg && repoLayout.focus && repoLayout.focus.kids) {
    // Manufacturing's levels vary from 2 children to a dozen, and the layout spreads wide ones
    // further out to keep them apart — so a fixed zoom per depth would either clip a wide folder or
    // waste the window on a narrow one. Fit the newest level instead, floored so labels stay
    // readable (the zoom control and drag-pan cover anything past that).
    const { parent, kids } = repoLayout.focus
    const pts = [parent, ...kids]
    const pad = 320
    const minX = Math.min(...pts.map((p) => p.left)) - pad
    const maxX = Math.max(...pts.map((p) => p.left)) + pad
    const minY = Math.min(...pts.map((p) => p.top)) - pad
    const maxY = Math.max(...pts.map((p) => p.top)) + pad
    const roomV = wheelBand(viewport.h).room * 2
    const roomH = viewport.w - 48
    baseScale = Math.max(0.13, Math.min(0.34, Math.min(roomV / (maxY - minY), roomH / (maxX - minX))))
    tx = -((minX + maxX) / 2) * baseScale
    ty = wheelHubY - viewport.h * 0.56 - ((minY + maxY) / 2) * baseScale
  } else if (!selected || isMfg) {

    tx = 0
    ty = wheelHubY - viewport.h * 0.56 + DETAIL_CENTRE_Y * DETAIL_ZOOM.branches
    baseScale = DETAIL_ZOOM.branches
  } else {

    const deepest = agentOpen && growth.facets
      ? growth.facets[Math.floor(growth.facets.length / 2)]
      : (agentOpen ? growth.agent : branch)
    const nodeZoom = agentOpen ? DETAIL_ZOOM.agentOpen : DETAIL_ZOOM.branchOpen

    const cx = (branch.left + deepest.left) / 2
    const cy = (branch.top + deepest.top) / 2
    tx = -cx * nodeZoom + (facetKey ? -SIDEBAR_W / 2 : 0)
    ty = -cy * nodeZoom - 60
    baseScale = nodeZoom
  }
  const worldStyle = {
    transform: `translate(${tx + pan.x}px,${ty + pan.y}px) scale(${baseScale * zoom})`,
    transition: dragging ? 'none' : undefined,
  }

  const pendingDept = pendingDeptKey ? DEPARTMENTS.find((d) => d.key === pendingDeptKey) : null
  const activeBg = view === 'fan' ? dept.bg : (pendingDept ? pendingDept.bg : DEFAULT_BG)

  return (
    <div
      className={`st-app ${view === 'fan' ? 'fanmode' : ''} ${selected ? 'zoomedin' : ''} ${dragging ? 'dragging' : ''}`}
      onPointerDown={onWorldPointerDown}
      onPointerMove={onWorldPointerMove}
      onPointerUp={onWorldPointerUp}
      onPointerCancel={onWorldPointerUp}
    >
      <Backdrop activeBg={activeBg} />

      <div id="st-sky">
        <Stars />
      </div>

      <div id="st-world" style={worldStyle}>
        {view === 'wheel' && <Hub onOpen={openDept} rotation={wheelRotation} spinning={dragging} pendingKey={pendingDeptKey} />}
        {view === 'fan' && (
          <div
            className="st-fan-slide"
            style={{
              transform: `translateX(${fanSlide.x}vw) scale(${fanSlide.scale})`,
              opacity: fanSlide.opacity,
              transition: fanSlide.animate
                ? 'transform 0.48s cubic-bezier(0.45, 0, 0.15, 1), opacity 0.48s ease'
                : 'none',
            }}
          >
            {isMfg ? (
              <RepoFan
                key={dept.key}
                dept={dept}
                openPath={repoPath}
                filePath={repoSidebar}
                onPickNode={pickRepoNode}
                revealed={branchesRevealed}
              />
            ) : (
              <Fan
                key={dept.key}
                dept={dept}
                branches={branches}
                selected={selected}
                growth={growth}
                agentOpen={agentOpen}
                facetKey={facetKey}
                onPickBranch={pickBranch}
                onToggleAgent={toggleAgent}
                onPickFacet={pickFacet}
                revealed={branchesRevealed}
              />
            )}
          </div>
        )}
      </div>

      {view === 'fan' && (
        <TopBar
          onBack={backToWheel}
        />
      )}
      {view === 'wheel' && <WheelTopBar />}

      {view === 'fan' && !selected && (
        <>
          <button className="st-edge st-edge-l" onClick={() => navigateDept(prevDept.key, -1)} style={{ '--c': prevDept.color }}>
            <ChevronIcon direction="left" />
            <span className="st-et">{prevDept.name}</span>
          </button>
          <button className="st-edge st-edge-r" onClick={() => navigateDept(nextDept.key, 1)} style={{ '--c': nextDept.color }}>
            <ChevronIcon direction="right" />
            <span className="st-et">{nextDept.name}</span>
          </button>
        </>
      )}

      {!isMfg && openFacet && (
        <FacetSidebar
          facet={openFacet}
          agent={growth.agent}
          dept={dept}
          onClose={() => setFacetKey(null)}
        />
      )}

      {/* Manufacturing's sidebar takes a path — a folder shows its files and the .json export, a
          file shows its contents. Same .st-side panel the other departments use. */}
      {isMfg && view === 'fan' && repoSidebar && (
        <RepoSidebar
          key={repoSidebar}
          dept={dept}
          path={repoSidebar}
          onClose={() => setRepoSidebar(null)}
        />
      )}

      {!isMfg && view === 'fan' && selected && (
        <button className="st-collapse" onClick={collapseAll}>× COLLAPSE {branch.name.toUpperCase()}</button>
      )}
      {isMfg && view === 'fan' && repoPath.length > 0 && (
        <button className="st-collapse" onClick={collapseRepo}>× COLLAPSE {repoPath[repoPath.length - 1].replace(/\.[^/.]+$/, '').toUpperCase()}</button>
      )}

      {view === 'wheel' && (
        <>
          <button className="st-wchev st-wchev-l"  onClick={rotatePrev}>
            <ChevronIcon direction="left" />
          </button>
          <button className="st-wchev st-wchev-r"  onClick={rotateNext}>
            <ChevronIcon direction="right" />
          </button>
        </>
      )}

      <div className="st-zoom">
        <button aria-label="zoom in" onClick={zoomIn}>+</button>
        <div className="st-zoom-pct" onClick={zoomReset} >{Math.round(zoom * 100)}%</div>
        <button aria-label="zoom out" onClick={zoomOut}>–</button>
      </div>
    </div>
  )
}

const BG_LAYERS = [...new Set([DEFAULT_BG, ...DEPARTMENTS.map((d) => d.bg)])]

function Backdrop({ activeBg }) {
  return (
    <div id="st-backdrop" aria-hidden="true">
      {BG_LAYERS.map((src) => {
        // encodeURI, because the delivered filenames contain spaces.
        const image = `url("${encodeURI(src)}")`
        return (
          <div key={src} className={`st-bg-layer ${src === activeBg ? 'on' : ''}`}>

            <div className="st-bg-half st-bg-half-l" style={{ backgroundImage: image }} />
            <div className="st-bg-half st-bg-half-r" style={{ backgroundImage: image }} />
          </div>
        )
      })}
      <div className="st-bg-veil" />
    </div>
  )
}

function Logo() {
  return <img className="st-logo" src="/logo.svg" alt="Company logo" />
}

function WheelTopBar() {
  return (
    <div className="st-topbar">
      <div className="st-tb-left">
        <Logo />
        <span className="st-tb-title">COMPANY KNOWLEDGE BASE</span>
      </div>
      <div className="st-tb-tabs">
      </div>
      <div className="st-tb-right">
        {/* <button className="st-callbtn" disabled title="disabled in this replica">Book a call</button> */}
      </div>
    </div>
  )
}


function TopBar({ onBack }) {
  return (
    <div className="fixed top-6 left-6 z-30 pointer-events-auto">
      <button
        onClick={onBack}
        className={cn(
          "group flex items-center gap-2.5 px-4 py-2 rounded-full transition-all duration-300 cursor-pointer select-none",
          "bg-white/80 hover:bg-white/95 text-slate-800 hover:text-slate-950",
          "border border-slate-200/80 hover:border-slate-300/90",
          "shadow-[0_4px_20px_-4px_rgba(15,30,77,0.12)] hover:shadow-[0_8px_25px_-4px_rgba(15,30,77,0.22)]",
          "backdrop-blur-xl hover:scale-105 active:scale-95"
        )}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300 text-slate-600">
          <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5] transition-transform duration-300 group-hover:-translate-x-0.5" />
        </span>
        <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em]">
          All Departments
        </span>
      </button>
    </div>
  )
}

// Deterministic RNG so the particle cloud is stable across re-renders without recomputing.
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Scattered twinkling background stars, sized/positioned/timed like the source's #stars.
const STAR_FIELD = (() => {
  const rnd = mulberry32(42)
  const stars = []
  for (let i = 0; i < 160; i++) {
    stars.push({
      left: rnd() * 100,
      top: rnd() * 100,
      size: rnd() < 0.7 ? 1.5 : 2.5,
      // Sky-blue dots on the light canvas need a bit more alpha than the original
      // ivory-on-near-black stars did to stay visible as background texture.
      opacity: 0.18 + rnd() * 0.3,
      delay: rnd() * 6,
      duration: 5 + rnd() * 5,
    })
  }
  return stars
})()

function Stars() {
  return STAR_FIELD.map((s, i) => (
    <div
      key={i}
      className="st-bgstar"
      style={{
        left: `${s.left}%`,
        top: `${s.top}%`,
        width: s.size,
        height: s.size,
        opacity: s.opacity,
        animationDelay: `${s.delay}s`,
        animationDuration: `${s.duration}s`,
      }}
    />
  ))
}

export const HUB_CORE_R = 168
const HUB_DOTS = 820

const HUB_CORE = (() => {
  const rnd = mulberry32(1337)
  const palette = DEPARTMENTS.map((d) => d.color)
  const dust = []
  for (let i = 0; i < HUB_DOTS; i++) {
    const angle = rnd() * Math.PI * 2
    // sqrt() keeps the areal density even instead of clumping everything at the centre.
    const dist = Math.sqrt(rnd()) * HUB_CORE_R
    const color = rnd() < 0.6 ? 'var(--ivory)' : palette[Math.floor(rnd() * palette.length)]
    dust.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: 0.5 + rnd() * 1.5, color, opacity: 0.3 + rnd() * 0.55 })
  }
  const links = []

  const maxDist = HUB_CORE_R * 0.13
  dust.forEach((p, i) => {
    const best = []
    dust.forEach((q, j) => {
      if (i === j) return
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      if (d < maxDist) best.push({ j, d })
    })
    best.sort((a, b) => a.d - b.d)
    best.slice(0, 3).forEach(({ j }) => {
      if (j > i) links.push({ x1: p.x, y1: p.y, x2: dust[j].x, y2: dust[j].y })
    })
  })
  return { dust, links }
})()

function HubCore() {
  return (
    <svg
      className="st-hub-svg"
      viewBox={`${-HUB_CORE_R} ${-HUB_CORE_R} ${HUB_CORE_R * 2} ${HUB_CORE_R * 2}`}
      width={HUB_CORE_R * 2}
      height={HUB_CORE_R * 2}
    >
      <g className="st-hub-spin">
        {HUB_CORE.links.map((l, i) => (
          // 0.1 rendered at ~0.04px on screen, i.e. invisible — the mesh has to be wide
          // enough to survive the wheel's scale-down or the dots read as unconnected.
          <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgb(var(--lnrgb))" strokeOpacity="0.3" strokeWidth="0.9" />
        ))}
        {HUB_CORE.dust.map((d, i) => (
          <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={d.color} opacity={d.opacity} />
        ))}
      </g>
      <circle className="st-hub-nucleus" cx="0" cy="0" r="7" fill="var(--copper)" />
    </svg>
  )
}


const SPOKE_DOT_COUNT = 16
const SPOKE_DOTS = Array.from({ length: SPOKE_DOT_COUNT }, (_, i) => {
  const t = i / SPOKE_DOT_COUNT
  return {
    r: [1.3, 2.1, 3.0, 4.0, 1.7, 2.6][i % 6],
    fill: i % 3 === 0 ? 'ivory' : 'dept',
    opacity: 0.35 + ((i * 7) % 10) / 10 * 0.55,
    dirOut: i % 2 === 1,
    durBase: 3.0 + ((i * 5) % 9) * 0.35,
    // Spread starts across the full travel time so the line is never briefly empty.
    delay: +(t * 5.2).toFixed(2),
  }
})

function Spokes() {
  return (
    <svg className="st-spokes" viewBox="-320 -320 640 640" width="640" height="640">
      {DEPARTMENTS.map((d, i) => {
        const inPath = `M 0 0 L ${d.wx} ${d.wy}`
        const outPath = `M ${d.wx} ${d.wy} L 0 0`
        return (
          <g key={d.key} style={{ '--c': d.color }}>
            <path d={inPath} className="st-spoke-line" />
            {SPOKE_DOTS.map((dot, di) => (
              <circle key={di} r={dot.r} fill={dot.fill === 'dept' ? 'var(--c-line)' : 'var(--c-text)'} opacity={dot.opacity}>
                <animateMotion
                  dur={`${dot.durBase + (i % 5) * 0.3}s`}
                  begin={`${dot.delay + (i % 3) * 0.4}s`}
                  repeatCount="indefinite"
                  path={dot.dirOut ? outPath : inPath}
                />
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

function ChevronIcon({ direction }) {
  const d = direction === 'left' ? 'M 11 3 L 4 11 L 11 19' : 'M 3 3 L 10 11 L 3 19'
  const cx = direction === 'left' ? 4 : 10
  return (
    <svg viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      <circle cx={cx} cy="11" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Hub({ onOpen, rotation, spinning, pendingKey }) {
  const ringStyle = { transform: `rotate(${rotation}deg)`, transition: spinning ? 'none' : undefined }
  return (
    <div id="st-hub">
      <div className="st-wheel-ring" style={ringStyle}>
        <Spokes />
      </div>
      <div className={`st-hub-core ${pendingKey ? 'st-dim' : ''}`}>
        <HubCore />
        <div className="st-hubhit" />
      </div>
      <div className={`st-wheel-ring ${pendingKey ? 'st-picking' : ''}`} style={ringStyle}>
        {DEPARTMENTS.map((d) => (
          <Mini key={d.key} dept={d} onOpen={onOpen} ringRotation={rotation} picked={d.key === pendingKey} />
        ))}
      </div>
    </div>
  )
}

function wedgePoints(angle, r0, r1, halfWidthDeg) {
  const halfWidthRad = (halfWidthDeg * Math.PI) / 180
  const a1 = angle - halfWidthRad
  const a2 = angle + halfWidthRad
  const pts = [
    [Math.cos(a1) * r0, Math.sin(a1) * r0],
    [Math.cos(a1) * r1, Math.sin(a1) * r1],
    [Math.cos(a2) * r1, Math.sin(a2) * r1],
    [Math.cos(a2) * r0, Math.sin(a2) * r0],
  ]
  return pts.map((p) => p.join(',')).join(' ')
}

function Mini({ dept, onOpen, ringRotation, picked }) {
  const deptIndex = DEPARTMENTS.findIndex((d) => d.key === dept.key)
  const tree = getWheelTree(dept.key, deptIndex, DEPARTMENTS.length)
  const angle = Math.atan2(dept.wy, dept.wx)
  // Both radii are measured outward from this department's own badge, and both are derived
  // from WHEEL_LABEL_OFFSET so they keep pace with TREE_SCALE — as hardcoded 480/580 they
  // would have been swallowed by the branches the moment the trees grew.
  const labelX = Math.cos(angle) * WHEEL_LABEL_OFFSET
  const labelY = Math.sin(angle) * WHEEL_LABEL_OFFSET
  // Apex 8px clear of the badge's own edge, derived so it can't end up inside the circle.
  const hitPoints = wedgePoints(angle, DEPT_BADGE_SIZE / 2 + 8, WHEEL_LABEL_OFFSET + 100, 34)
  return (
    <button
      className={`st-mini ${picked ? 'st-mini-picked' : ''}`}
      style={{ left: dept.wx, top: dept.wy, '--c': dept.color, '--badge-size': `${DEPT_BADGE_SIZE}px` }}
      onClick={() => onOpen(dept.key)}
    >
      <svg className="st-mini-hit" style={{ left: 0, top: 0, overflow: 'visible' }}>
        <polygon points={hitPoints} />
      </svg>
      <div className="st-mini-rot" style={{ transform: `rotate(${tree.rotate}deg)` }}>
        <svg className="st-mini-lines" viewBox="-360 -370 720 460" width="720" height="460" style={{ left: -360, top: -370 }}>
          {tree.branches.map((branch, bi) => {
            const pts = [{ x: 0, y: 0 }, ...branch]
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
            return (
              <g key={bi}>
                <path d={d} />
                <circle cx={branch[0].x} cy={branch[0].y} r="4" fill={dept.color} />
              </g>
            )
          })}
        </svg>
        {tree.branches.map((branch, bi) =>
          branch.slice(1).map((p, pi) => (
            <span key={`${bi}-${pi}`} className={`st-jdot st-jdot-${p.status}`} style={{ left: p.x, top: p.y }} />
          ))
        )}
      </div>
      <div className="st-mini-badge" style={{ transform: `rotate(${-ringRotation}deg)` }} dangerouslySetInnerHTML={{ __html: svgIcon(dept.icon) }} />
      <div className="st-wname" style={{ left: labelX, top: labelY, transform: `translate(-50%,-50%) rotate(${-ringRotation}deg)` }}>
        <div className="st-nm">{dept.name}</div>
        <div className="st-sb">{dept.sub}</div>
      </div>
    </button>
  )
}


function Fan({ dept, branches, selected, growth, agentOpen, facetKey, onPickBranch, onToggleAgent, onPickFacet, revealed }) {

  const grown = growth ? [growth.agent, ...(growth.facets || [])] : []
  const xs = [0, ...branches.map((b) => b.left), ...grown.map((g) => g.left)]
  const ys = [0, ...branches.map((b) => b.top), ...grown.map((g) => g.top)]
  const minX = Math.min(...xs) - 320
  const maxX = Math.max(...xs) + 320
  const minY = Math.min(...ys) - 320
  const maxY = Math.max(...ys) + 320
  return (
    <div className={`st-fan ${revealed ? 'revealed' : ''} ${selected ? 'focused' : ''}`} style={{ '--c': dept.color }}>
      <div className="st-ghost">{dept.name}</div>
      <svg className="st-lines" style={{ left: minX, top: minY, width: maxX - minX, height: maxY - minY }}>
        <g transform={`translate(${-minX},${-minY})`}>
          {/* root -> each branch, all drawing outward together */}
          <g className="st-baselines">
            {branches.map((b, i) => {
              const mx = b.left * 0.45
              const my = b.top * 0.45
              const len = Math.hypot(b.left, b.top) || 1
              const px = (-b.top / len) * 26
              const py = (b.left / len) * 26
              return (
                <g key={b.key}>
                  <path className="st-drawline" style={{ '--d': `${i * 0.08}s` }} d={`M 0 0 L ${b.left} ${b.top}`} pathLength="1" />
                  <g className="st-edge-marker" style={{ '--d': `${i * 0.08 + 0.3}s` }}>
                    <line x1={mx} y1={my} x2={mx + px} y2={my + py} />
                    <circle cx={mx + px} cy={my + py} r="7" />
                  </g>
                </g>
              )
            })}
          </g>

          {growth && (
            <g className="st-grow">
              <path
                className="st-drawline st-drawline-agent"
                d={`M ${growth.branch.left} ${growth.branch.top} L ${growth.agent.left} ${growth.agent.top}`}
                pathLength="1"
              />
              {growth.facets && growth.facets.map((f, i) => (
                <path
                  key={f.key}
                  className="st-drawline st-drawline-facet"
                  style={{ '--d': `${i * 0.09}s` }}
                  d={`M ${growth.agent.left} ${growth.agent.top} L ${f.left} ${f.top}`}
                  pathLength="1"
                />
              ))}
            </g>
          )}
        </g>
      </svg>

      <div className="st-root-badge" dangerouslySetInnerHTML={{ __html: svgIcon(dept.icon) }} />
      <div className="st-root-name">{dept.name}</div>

      {/* --- level 1: one node per branch --- */}
      {branches.map((b, i) => {
        const isOpen = b.key === selected
        return (
          <button
            key={b.key}
            className={`st-node st-bnode st-node-${b.status} ${isOpen ? 'selected' : ''} ${selected && !isOpen ? 'faded' : ''}`}
            style={{ left: b.left, top: b.top, '--d': `${0.5 + i * 0.08}s` }}
            onClick={() => onPickBranch(b.key)}
          >
            <span className="st-node-icon" dangerouslySetInnerHTML={{ __html: svgIcon(b.icon) }} />
            <span className="st-nlabel">{b.name}</span>
            {/* Jobs inside this branch — the affordance that says the node opens. */}
            <span className="st-nkids">{b.jobs.length}</span>
          </button>
        )
      })}

      {/* --- level 2: that branch's agent --- */}
      {growth && (
        <button
          className={`st-node st-anode st-node-${growth.agent.status} ${agentOpen ? 'selected' : ''}`}
          style={{ left: growth.agent.left, top: growth.agent.top, '--d': '0.28s' }}
          onClick={onToggleAgent}
        >
          <span className="st-node-icon" dangerouslySetInnerHTML={{ __html: svgIcon('users') }} />
          <span className="st-nlabel">{growth.agent.name}</span>
        </button>
      )}

      {/* --- level 3: skills / connectors / artifacts --- */}
      {growth && growth.facets && growth.facets.map((f, i) => (
        <button
          key={f.key}
          className={`st-node st-fnode ${f.key === facetKey ? 'selected' : ''}`}
          style={{ left: f.left, top: f.top, '--d': `${0.28 + i * 0.09}s` }}
          onClick={() => onPickFacet(f.key)}
        >
          <span className="st-node-icon" dangerouslySetInnerHTML={{ __html: svgIcon(f.icon) }} />
          <span className="st-nlabel">{f.label}</span>
          <span className="st-nkids">{f.count}</span>
        </button>
      ))}
    </div>
  )
}

// Opened by clicking one of the three facet nodes — the only place in this flow that shows a
// list, since the three levels before it are all structure the tree can carry itself.
function FacetSidebar({ facet, agent, dept, onClose }) {
  const items = agent[facet.key]
  return (
    <aside className="st-side" style={{ '--c': dept.color }}>
      <button className="st-side-x" onClick={onClose} aria-label="close">×</button>
      <div className="st-side-body">
        <div className="st-side-title">
          <span className="st-side-icon" dangerouslySetInnerHTML={{ __html: svgIcon(facet.icon) }} />
          <span className="st-side-name">{facet.label}</span>
          <span className="st-side-n">{items.length}</span>
        </div>
        <p className="st-side-desc">{FACET_BLURB[facet.key]}</p>

        <div className="st-items">
          {items.map((it) => (
            <div key={it.name} className="st-item">
              <div className="st-item-top">
                <span className="st-item-name">{it.name}</span>
                <span className={`st-ipill st-ipill-${it.status || it.meta}`}>{it.status || it.meta}</span>
              </div>
              <p className="st-item-desc">{it.desc}</p>
            </div>
          ))}
        </div>

        {/* Only the skills list has a matching .md file behind it; the other two facets describe
            wiring and output, which aren't things you download. */}
        {facet.key === 'skills' && (
          <div className="st-side-sec">
            <div className="st-side-h">THE SKILL FILE · LOCKED</div>
            <div className="st-dl-locked">
              <div className="st-dl-top">
                <span>🔒</span>
                <span className="st-dl-name">{agent.name}</span>
                <span className="st-dl-tag">LOCKED · TAP TO PREVIEW</span>
              </div>
              <p className="st-dld">{agent.desc}</p>
              <code className="st-dl-file">skills/{agent.file ? agent.file.replace(/\.md$/i, '') : ''}</code>
            </div>
            <div className="st-side-cta">
              <button className="st-skbuy" disabled>Get Access · $49/mo</button>
              <button className="st-skbook" disabled>Book a call</button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

const FACET_BLURB = {
  skills: 'What this agent can do. Each one is a job the branch used to carry as its own node.',
  connectors: 'The systems it reads from and writes to. Anything marked available is wired but not switched on yet.',
  artifacts: 'What it produces, and where the output lands once a run finishes.',
}

