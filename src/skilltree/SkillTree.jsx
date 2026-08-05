import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_BG, DEPARTMENTS, WHEEL_RADIUS, getBranches } from './data.js'
import { svgIcon } from './icons.js'
import { WHEEL_LABEL_OFFSET, getWheelTree } from './wheelData.js'
import './SkillTree.css'

// Two views, and one growing tree inside the second:
//   'wheel' -> the hub + 7 orbiting department mini-trees (html1.html, verbatim geometry)
//   'fan'   -> that department's details tree: the root badge plus ONE node per branch.
//              Clicking a branch grows its agent; clicking the agent grows three facet nodes
//              (skills / connectors / artifacts); clicking a facet opens the sidebar.
// The wheel geometry is unchanged from the capture. The details tree used to be a chain of job
// nodes per branch (html2/html3); those jobs are now the skills of the branch's agent.
const ZOOM_MIN = 0.4
const ZOOM_MAX = 3
const ZOOM_STEP = 0.2
const DEPT_STEP = 360 / DEPARTMENTS.length

// Diameter of a department's main badge circle. Lives here rather than in CSS because the
// hover wedge's apex has to start just outside it — as a bare number in the CSS the two would
// drift apart and the wedge would end up buried inside the badge.
const DEPT_BADGE_SIZE = 144

// Vertical framing for the wheel. The usable band runs from under the top bar down to the
// rotate chevrons at bottom 8.5%, and the hub is centred in that band. Left at the CSS 56%
// anchor the entire upper half of the screen went unused and the wheel had only ~35% of the
// viewport height to grow into — centring it is where most of the extra size comes from.
// hubScreenCenter() reads the same figure; if the two disagree, drag-rotation pivots around
// the wrong point.
const TOPBAR_H = 110
const CHEVRON_TOP = 0.915

function wheelBand(h) {
  const bottom = h * CHEVRON_TOP
  return { centre: (TOPBAR_H + bottom) / 2, room: (bottom - TOPBAR_H) / 2 }
}

// World radius the wheel must fit, out through the badge ring and branch tips to the name
// label. Vertically the labels overhang their anchor by about half a name block; horizontally
// by the widest sub-label's half-width — without that second term the left/right department
// names get clipped off the edge of a narrow window.
const LABEL_HALF_H = 66
const LABEL_HALF_W = 330
const WHEEL_WORLD_V = WHEEL_RADIUS + WHEEL_LABEL_OFFSET + LABEL_HALF_H
const WHEEL_WORLD_H = WHEEL_RADIUS + WHEEL_LABEL_OFFSET + LABEL_HALF_W

function fitWheelScale(w, h) {
  const fit = Math.min(wheelBand(h).room / WHEEL_WORLD_V, (w * 0.5 - 16) / WHEEL_WORLD_H)
  // Floor low enough that a small window fits the whole wheel rather than clipping it.
  return Math.max(0.2, Math.min(0.62, fit))
}

// --- Branch growth: branch -> its agent -> the agent's three facets ---
// The details view starts as the root badge plus one node per branch. Clicking a branch grows its
// agent straight on along that branch's own outward direction; clicking the agent grows three
// facet nodes fanned off it. Each level keeps going the way the last edge pointed, so the whole
// thing reads as the same branch continuing to grow rather than clusters dropped nearby.
// Both edges are longer than the root -> branch spokes: growth should feel like the branch
// pushing well clear of the ring, not a short stub. FACET_SPREAD is wide enough that adjacent
// facet labels can't touch — at 620 units out, 58° puts ~600 units between neighbouring centres,
// against a ~490-unit label width for the longest ("CONNECTORS").
const AGENT_DIST = 620
const FACET_DIST = 620
const FACET_SPREAD = 58

const AGENT_FACETS = [
  { key: 'skills', label: 'Skills', icon: 'facetSkills' },
  { key: 'connectors', label: 'Connectors', icon: 'facetConnectors' },
  { key: 'artifacts', label: 'Artifacts', icon: 'facetArtifacts' },
]

// Width of the facet sidebar. Also the amount the canvas shifts when it opens, so the node you
// just clicked doesn't end up underneath the panel — must match .st-side's width in the CSS.
const SIDEBAR_W = 400

// Render scale for the details tree, one step per depth: the ring alone, a branch open (out to
// its agent), and the agent open (out to the facets). Each step pulls back just far enough for
// the newly grown level to fit. Node label sizes in the CSS are tuned against these three
// numbers — they are world units, so changing a zoom here changes what every label measures on
// screen. Keep the two in step.
// The two open states frame the expansion itself (centred between the branch and the deepest
// node), not the whole tree, so they can sit much closer in than a whole-tree fit would allow —
// the root badge and the far side of the ring simply fall out of frame, which is the point.
const DETAIL_ZOOM = { branches: 0.38, branchOpen: 0.34, agentOpen: 0.28 }

// Vertical middle of the branch-ring view in world units. The ring grows upward from the root
// badge at (0,0), so its visual centre is well above the origin; without this the tree renders
// low and clipped at the top.
const DETAIL_CENTRE_Y = 390

// Places `count` children on an arc centred on dirAngle, so an odd count keeps one child dead
// ahead of the branch and the rest splay symmetrically either side of it.
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

  // Reset pan whenever the view/department/selection changes (adjusting state
  // during render, per React's guidance, instead of an effect that would cause
  // an extra render pass).
  const panResetKey = `${view}|${deptKey}|${selected ? selected.name : ''}`
  const [prevPanKey, setPrevPanKey] = useState(panResetKey)
  if (prevPanKey !== panResetKey) {
    setPrevPanKey(panResetKey)
    if (pan.x !== 0 || pan.y !== 0) setPan({ x: 0, y: 0 })
  }

  // The hub sits at #st-world's local (0,0); #st-world is anchored at 50%/56% of the
  // (fixed, full-viewport) app root, so that's the on-screen center to rotate the drag
  // angle around.
  function hubScreenCenter() {
    // Must match where the wheel's ty actually puts the hub, not #st-world's CSS anchor —
    // a mismatch shows up as drag-rotation pivoting around the wrong point.
    return { x: viewport.w * 0.5, y: wheelHubY }
  }

  function onWorldPointerDown(e) {
    if (e.target.closest('button, textarea, a, input, .st-side')) return
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
    // Three clean phases, never overlapping: 1) spin the wheel ring 180° clockwise
    // while still showing the wheel, 2) hold there for a beat once it settles, so
    // the rotation reads as its own moment rather than rushing straight on, then
    // 3) swap to the fan view and let its own zoom-in transition play. Doing the
    // swap immediately would mean the fan content renders mid-spin (briefly
    // upside down/mirrored) instead of a smooth, single-direction motion.
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
    // Three smooth beats instead of an instant swap: 1) the current department
    // recedes backward (shrinks + fades) rather than just sliding off, 2) the new
    // one enters from the side and grows up to full size ("frontside"), 3) only
    // once its root badge is at rest do the branches draw themselves in, after a
    // short pause.
    if (entering) return
    setEntering(true)
    setBranchesRevealed(false)
    setFanSlide({ x: 0, scale: 0.7, opacity: 0, animate: true })
    slideTimerRef.current = setTimeout(() => {
      setDeptKey(key)
      setSelected(null)
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
    setView('wheel')
  }

  let tx, ty, baseScale
  if (view === 'wheel') {
    tx = 0
    // #st-world is anchored at top: 56%, so this is the shift that lands the hub on
    // wheelHubY, the centre of the usable band.
    ty = wheelHubY - viewport.h * 0.56
    baseScale = wheelScale
  } else if (!selected) {
    // The branch ring reaches ~700 units plus its labels, where the old job-chain fan reached
    // ~1900 — so it needs a much larger scale than the 0.26 inherited from that fan, which is
    // what made every label look shrunken. Centred on the tree's own middle (the ring sits above
    // the root badge, so that middle is well above the origin) rather than a magic offset.
    tx = 0
    ty = wheelHubY - viewport.h * 0.56 + DETAIL_CENTRE_Y * DETAIL_ZOOM.branches
    baseScale = DETAIL_ZOOM.branches
  } else {
    // Frame the deepest thing that's grown, pulling back a step per level so the new nodes have
    // room to appear instead of pushing off screen.
    const deepest = agentOpen && growth.facets
      ? growth.facets[Math.floor(growth.facets.length / 2)]
      : (agentOpen ? growth.agent : branch)
    const nodeZoom = agentOpen ? DETAIL_ZOOM.agentOpen : DETAIL_ZOOM.branchOpen
    // Centre between the branch and the deepest node, so the branch that got you there stays in
    // frame rather than the view jumping to the tip alone. Shifted left when the sidebar is open
    // so the panel doesn't cover what you just clicked.
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

  // While a department is being picked the view is still the wheel, but we switch the
  // backdrop to the incoming department immediately, so its crossfade runs *under* the
  // ring spin instead of starting after it — one continuous motion rather than two.
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

      {/* The canvas carries the structure, the sidebar carries the words. It opens only at the
          last level — clicking one of the three facet nodes — so the earlier steps stay a pure
          tree and nothing covers the canvas until there's a list to read. */}
      {openFacet && (
        <FacetSidebar
          facet={openFacet}
          agent={growth.agent}
          branch={branch}
          dept={dept}
          onClose={() => setFacetKey(null)}
        />
      )}

      {view === 'fan' && selected && (
        <button className="st-collapse" onClick={collapseAll}>× COLLAPSE {branch.name.toUpperCase()}</button>
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

// Every backdrop that can ever be shown, deduped (DEFAULT_BG may double as a
// department's image). All layers are mounted at once and switched purely by opacity:
// that gives an instant, flash-free crossfade, and because a layer at opacity 0 still
// has its background-image fetched, mounting them *is* the preload — no separate
// warm-up pass to keep in sync.
const BG_LAYERS = [...new Set([DEFAULT_BG, ...DEPARTMENTS.map((d) => d.bg)])]

function Backdrop({ activeBg }) {
  return (
    <div id="st-backdrop" aria-hidden="true">
      {BG_LAYERS.map((src) => {
        // encodeURI, because the delivered filenames contain spaces.
        const image = `url("${encodeURI(src)}")`
        return (
          <div key={src} className={`st-bg-layer ${src === activeBg ? 'on' : ''}`}>
            {/* The art occupies only the left portion of each source image, so each half
                of the screen renders that same left portion and the right one is mirrored.
                That frames both edges symmetrically and leaves the middle — where the hub
                and labels sit — clear, instead of loading all the art onto one side. */}
            <div className="st-bg-half st-bg-half-l" style={{ backgroundImage: image }} />
            <div className="st-bg-half st-bg-half-r" style={{ backgroundImage: image }} />
          </div>
        )
      })}
      <div className="st-bg-veil" />
    </div>
  )
}

// Departments overview only. Deliberately NOT rendered by TopBar below, so it stays off the
// department-detail view and off the open card.
// TODO: replace the alt text with the actual brand name.
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

// Department-detail (fan) view — rendered whenever view === 'fan', which is also the only
// state in which the card can be open. No <Logo /> here, by design.
function TopBar({ onBack }) {
  return (
    <div className="st-topbar">
      <div className="st-tb-left">
        <button className="st-back" onClick={onBack}>← ALL DEPARTMENTS</button>
      </div>
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

// Neural-network-style particle mesh: a dense cloud of dots, each linked to its 1-2
// nearest neighbors, rather than a fixed branch/trunk structure.
// Globe-like core: a dense speckle of fine dots, each wired to its nearest neighbours so the
// whole thing reads as one connected mesh rather than loose confetti. HUB_CORE_R is the
// particle radius in world units; .st-hub-core's box is sized from it.
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
  // Scaled with the radius so the mesh keeps the same visual density as it grows; up to 3
  // links per dot (was 2) makes the web read as a network rather than short dashes.
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

// Per spoke: a little train of dots flowing between the department and the hub,
// mixing small/medium/big sizes and both directions instead of just two dots.
// Generated rather than hand-listed so the count is one number. Sizes, speeds, directions and
// start offsets are all staggered by index, giving a continuous two-way traffic of signals
// along every spoke instead of a few sparse blips.
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

// A pie-slice-shaped hover/click target, apex at the department's own badge and
// opening outward (away from the hub), so hovering the branch tips or the empty
// space near the label still counts as hovering that whole department.
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

// The department details tree. Starts as the root badge plus one node per branch; a branch grows
// its agent when clicked, and the agent grows the three facet nodes. Every edge uses the same
// .st-drawline class, so a level that mounts draws itself on exactly like the original branches.
function Fan({ dept, branches, selected, growth, agentOpen, facetKey, onPickBranch, onToggleAgent, onPickFacet, revealed }) {
  // Grown nodes sit outside the branch ring, so they have to be inside the bounds the line <svg>
  // is sized from or their edges get clipped.
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
function FacetSidebar({ facet, agent, branch, dept, onClose }) {
  const items = agent[facet.key]
  return (
    <aside className="st-side" style={{ '--c': dept.color }}>
      <button className="st-side-x" onClick={onClose} aria-label="close">×</button>
      <div className="st-side-body">
        <div className="st-side-crumb">{dept.name} · {branch.name} · {agent.name}</div>
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
              <code className="st-dl-file">skills/{agent.file}</code>
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

