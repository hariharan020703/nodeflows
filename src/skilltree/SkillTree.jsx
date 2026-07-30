import { useEffect, useMemo, useRef, useState } from 'react'
import { DEPARTMENTS, getFan } from './data.js'
import { svgIcon } from './icons.js'
import { WHEEL_TREES } from './wheelData.js'
import './SkillTree.css'

// Three states, matching the three captured pages 1:1:
//   'wheel'        -> html1.html  (hub + 7 orbiting department mini-trees)
//   'fan'          -> html2.html  (one department's root badge + team chains)
//   'fan'+selected -> html3.html  (same fan, zoomed on one node, detail card open)
const ZOOM_MIN = 0.4
const ZOOM_MAX = 3
const ZOOM_STEP = 0.2
const DEPT_STEP = 360 / DEPARTMENTS.length

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
  const [selected, setSelected] = useState(null)
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
    return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.56 }
  }

  function onWorldPointerDown(e) {
    if (e.target.closest('button, textarea, a, input, #st-card')) return
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
  const fan = useMemo(() => getFan(deptKey), [deptKey])
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
    ty = -29.2
    baseScale = 0.3415
  } else if (!selected) {
    tx = 0
    ty = 159.3
    baseScale = 0.2604
  } else {
    // Smaller than before (was 1.35) so clicking a node zooms in less aggressively.
    const nodeZoom = 0.30
    tx = -selected.left * nodeZoom
    ty = -selected.top * nodeZoom - 60
    baseScale = nodeZoom
  }
  const worldStyle = {
    transform: `translate(${tx + pan.x}px,${ty + pan.y}px) scale(${baseScale * zoom})`,
    transition: dragging ? 'none' : undefined,
  }

  return (
    <div
      className={`st-app ${view === 'fan' ? 'fanmode' : ''} ${selected ? 'zoomedin' : ''} ${dragging ? 'dragging' : ''}`}
      onPointerDown={onWorldPointerDown}
      onPointerMove={onWorldPointerMove}
      onPointerUp={onWorldPointerUp}
      onPointerCancel={onWorldPointerUp}
    >
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
              fan={fan}
              selected={selected}
              onSelect={setSelected}
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

      {selected && (
        <Card node={selected} dept={dept} onClose={() => setSelected(null)} />
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

function WheelTopBar() {
  return (
    <div className="st-topbar">
      <div className="st-tb-left">
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
      opacity: 0.08 + rnd() * 0.25,
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
const HUB_CORE = (() => {
  const rnd = mulberry32(1337)
  const palette = ['#FF9D5C', '#EF4444', '#A78BFA', '#5EEAD4', '#7DD3FC', '#FB7185', '#FACC15']
  const dust = []
  for (let i = 0; i < 220; i++) {
    const angle = rnd() * Math.PI * 2
    const dist = Math.sqrt(rnd()) * 112
    const color = rnd() < 0.65 ? 'var(--ivory)' : palette[Math.floor(rnd() * palette.length)]
    dust.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: 0.6 + rnd() * 1.4, color, opacity: 0.25 + rnd() * 0.5 })
  }
  const links = []
  const maxDist = 22
  dust.forEach((p, i) => {
    let best = []
    dust.forEach((q, j) => {
      if (i === j) return
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      if (d < maxDist) best.push({ j, d })
    })
    best.sort((a, b) => a.d - b.d)
    best.slice(0, 2).forEach(({ j }) => {
      if (j > i) links.push({ x1: p.x, y1: p.y, x2: dust[j].x, y2: dust[j].y })
    })
  })
  return { dust, links }
})()

function HubCore() {
  return (
    <svg className="st-hub-svg" viewBox="-122 -122 244 244" width="244" height="244">
      <g className="st-hub-spin">
        {HUB_CORE.links.map((l, i) => (
          <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgb(var(--lnrgb))" strokeOpacity="0.14" strokeWidth="0.1" />
        ))}
        {HUB_CORE.dust.map((d, i) => (
          <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={d.color} opacity={d.opacity} />
        ))}
      </g>
      <circle className="st-hub-nucleus" cx="0" cy="0" r="4.5" fill="var(--copper)" />
    </svg>
  )
}

// Per spoke: a little train of dots flowing between the department and the hub,
// mixing small/medium/big sizes and both directions instead of just two dots.
const SPOKE_DOTS = [
  { r: 3.4, fill: 'dept', opacity: 0.95, dirOut: false, durBase: 3.2, delay: 0 },
  { r: 1.4, fill: 'ivory', opacity: 0.45, dirOut: true, durBase: 4.1, delay: 0.6 },
  { r: 2.2, fill: 'dept', opacity: 0.75, dirOut: false, durBase: 3.7, delay: 1.4 },
  { r: 4.2, fill: 'ivory', opacity: 0.55, dirOut: true, durBase: 5.2, delay: 2.1 },
  { r: 1.7, fill: 'dept', opacity: 0.6, dirOut: false, durBase: 3.9, delay: 2.9 },
  { r: 2.8, fill: 'ivory', opacity: 0.4, dirOut: true, durBase: 4.6, delay: 3.6 },
]

function Spokes() {
  return (
    <svg className="st-spokes" viewBox="-320 -320 640 640" width="640" height="640">
      {DEPARTMENTS.map((d, i) => {
        const inPath = `M 0 0 L ${d.wx} ${d.wy}`
        const outPath = `M ${d.wx} ${d.wy} L 0 0`
        return (
          <g key={d.key}>
            <path d={inPath} className="st-spoke-line" />
            {SPOKE_DOTS.map((dot, di) => (
              <circle key={di} r={dot.r} fill={dot.fill === 'dept' ? d.color : 'var(--ivory)'} opacity={dot.opacity}>
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
  const tree = WHEEL_TREES[dept.key]
  const angle = Math.atan2(dept.wy, dept.wx)
  const labelX = Math.cos(angle) * 480
  const labelY = Math.sin(angle) * 480
  const hitPoints = wedgePoints(angle, 45, 580, 34)
  return (
    <button
      className={`st-mini ${picked ? 'st-mini-picked' : ''}`}
      style={{ left: dept.wx, top: dept.wy, '--c': dept.color }}
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

function Fan({ dept, fan, selected, onSelect, revealed }) {
  const minX = Math.min(0, ...fan.nodes.map((n) => n.left)) - 200
  const maxX = Math.max(0, ...fan.nodes.map((n) => n.left)) + 200
  const minY = Math.min(0, ...fan.nodes.map((n) => n.top)) - 200
  const maxY = Math.max(0, ...fan.nodes.map((n) => n.top)) + 200
  return (
    <div className={`st-fan ${revealed ? 'revealed' : ''}`} style={{ '--c': dept.color }}>
      <div className="st-ghost">{dept.name}</div>
      <svg className="st-lines" style={{ left: minX, top: minY, width: maxX - minX, height: maxY - minY }}>
        <g transform={`translate(${-minX},${-minY})`}>
          {fan.lines.map((l, i) => {
            // All chains start at the same moment; within a chain, segments draw
            // one after another outward from the root (delay keyed on `seg`,
            // the segment's position along its own chain — not the flat index).
            const delay = l.seg * 0.32
            const dx = l.x2 - l.x1
            const dy = l.y2 - l.y1
            const len = Math.hypot(dx, dy) || 1
            const mx = l.x1 + dx * 0.4
            const my = l.y1 + dy * 0.4
            const px = (-dy / len) * 26
            const py = (dx / len) * 26
            return (
              <g key={i}>
                <path className="st-drawline" style={{ '--d': `${delay}s` }} d={`M ${l.x1} ${l.y1} L ${l.x2} ${l.y2}`} pathLength="1" />
                <g className="st-edge-marker" style={{ '--d': `${delay + 0.3}s` }}>
                  <line x1={mx} y1={my} x2={mx + px} y2={my + py} />
                  <circle cx={mx + px} cy={my + py} r="7" />
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="st-root-badge" dangerouslySetInnerHTML={{ __html: svgIcon(dept.icon) }} />
      <div className="st-root-name">{dept.name}</div>

      {fan.teams.map((t) => (
        <div key={t.name} className="st-team-label" style={{ left: t.left, top: t.top }}>
          {t.name}
        </div>
      ))}

      {fan.nodes.map((n) => {
        const isSelected = selected && selected.name === n.name
        const faded = selected && !isSelected
        return (
          <button
            key={n.name}
            className={`st-node st-node-${n.status} ${isSelected ? 'selected' : ''} ${faded ? 'faded' : ''}`}
            style={{ left: n.left, top: n.top, '--d': `${(n.seg || 0) * 0.32 + 0.6}s` }}
            onClick={() => onSelect(n)}
          >
            <span className="st-node-icon" dangerouslySetInnerHTML={{ __html: svgIcon(n.icon) }} />
            {n.tag && <span className="st-ftag">{n.tag}</span>}
            <span className="st-nlabel">{n.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function Card({ node, dept, onClose }) {
  const c = node.card
  return (
    <div id="st-card" className="open" style={{ '--c': dept.color }}>
      <button className="st-c-x" onClick={onClose} aria-label="close">×</button>
      <div className="st-c-state">{node.status === 'deployed' ? 'fully autonomous' : node.status === 'dev' ? 'human-assisted' : 'human-led'}</div>
      <div className="st-c-name">
        {node.name}
        {node.tag && <span className="st-c-found">{node.tag}</span>}
      </div>
      <div className="st-c-crumb">{c.crumb}</div>
      <p className="st-c-desc">{c.desc}</p>

      <div className="st-c-section">
        <div className="st-c-h">BREAKS INTO</div>
        <div className="st-c-skills">
          {c.skills.map((s) => (
            <span key={s} className="st-c-skill">{s}</span>
          ))}
        </div>
      </div>

      <div className="st-c-section">
        <div className="st-c-h">YOUR STATUS</div>
        <div className="st-c-my">
          <span className={node.status === 'plan' ? 'on' : ''}>Not started</span>
          <span className={node.status === 'dev' ? 'on' : ''}>In development</span>
          <span className={node.status === 'deployed' ? 'on' : ''}>Live</span>
        </div>
      </div>

      <div className="st-c-section">
        <div className="st-c-h">YOUR NOTES</div>
        <textarea className="st-c-note" placeholder="Add a note…" />
      </div>

      <div className="st-c-section">
        <div className="st-c-h">BUILDS ON</div>
        <div className="st-c-req">{c.buildsOn}</div>
      </div>

      <div className="st-c-section">
        <div className="st-c-h">WHAT IT REPLACES</div>
        <p className="st-c-replaces">{c.replaces}</p>
      </div>

      <div className="st-c-section">
        <div className="st-c-h">THE LADDER</div>
        <div className="st-ladder">
          <div className="st-lrow">
            <span>Human-led</span>
            <p>{c.ladder.humanLed}</p>
          </div>
          <div className={`st-lrow ${node.status === 'dev' ? 'cur' : ''}`}>
            <span>Human-assisted</span>
            <p>{c.ladder.humanAssisted}</p>
          </div>
          <div className={`st-lrow ${node.status === 'deployed' ? 'cur' : ''}`}>
            <span>Fully autonomous</span>
            <p>{c.ladder.fullyAutonomous}</p>
          </div>
        </div>
      </div>

      <div className="st-c-section">
        <div className="st-c-h">THE HUMAN</div>
        <p className="st-c-replaces">{c.human}</p>
      </div>

      <div className="st-c-section">
        <div className="st-c-h">BUILD NOTES</div>
        <p className="st-c-replaces">{c.notes}</p>
      </div>

      <div className="st-c-section">
        <div className="st-c-h">THE SKILLS · LOCKED</div>
        <div className="st-dl st-dl-locked">
          <div className="st-dl-top">
            <span>🔒</span>
            <span className="st-dl-name">{node.skill}</span>
            <span className="st-dl-tag">LOCKED · TAP TO PREVIEW</span>
          </div>
          <p className="st-dld">{c.fileDesc}</p>
          <code className="st-dl-file">skills/{node.file}</code>
        </div>
      </div>

      <div className="st-c-cta">
        <button className="st-skbuy" disabled >Get Access · $49/mo</button>
        <button className="st-skbook" disabled >Book a call</button>
      </div>
      <button className="st-needhelp" disabled >Need help building this?</button>
    </div>
  )
}
