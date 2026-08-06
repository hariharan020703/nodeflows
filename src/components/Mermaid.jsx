import { useEffect, useId, useState } from 'react'
import {  Workflow } from 'lucide-react'
import { cn } from '../lib/utils.js'

// Renders a ```mermaid fenced block as a diagram, themed to match the canvas rather than using
// mermaid's stock look.
//
// mermaid is ~80MB on disk and a few hundred KB in a bundle, so it is imported dynamically inside the
// effect: a document with no diagram in it never loads the library, and the main chunk is unaffected.

// The brand palette, mirrored here because mermaid needs concrete colours: it derives shades from
// what you give it (border darkening, contrast text), and those computations cannot run on a
// `var(--c-line)` string. Kept in sync with .st-app's tokens in index.css.
const NAVY = '#0f1e4d'
const INK = '#2c2c2c'
const LIGHT = '#f5f7fa'

function hex(c) {
  const s = c.replace('#', '')
  const n = s.length === 3 ? s.split('').map((x) => x + x).join('') : s
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

// Same mix the stylesheet does for --c-line / --c-text: the department's accent pulled toward navy
// so it stays legible on white. Doing it in JS keeps a diagram's lines the exact colour of the
// branches on the canvas for that department.
function mix(a, b, ratio) {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const p = (x, y) => Math.round(x * ratio + y * (1 - ratio))
  return `#${[p(r1, r2), p(g1, g2), p(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function themeFor(accent) {
  const line = mix(accent, NAVY, 0.6) // --c-line
  const text = mix(accent, NAVY, 0.45) // --c-text
  const tint = mix(accent, '#ffffff', 0.1) // the soft fill the panel's cards use
  return {
    startOnLoad: false,
    // 'base' is the only built-in theme that honours themeVariables wholesale.
    theme: 'base',
    // Labels come from repo documents, so let mermaid sanitise them.
    securityLevel: 'strict',
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, Segoe UI, sans-serif",
    themeVariables: {
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, Segoe UI, sans-serif",
      fontSize: '13px',
      // Nodes: white card, department-tinted hairline, navy label — the same recipe as a node on
      // the tree and a Card in the panel.
      primaryColor: '#ffffff',
      primaryBorderColor: line,
      primaryTextColor: NAVY,
      mainBkg: '#ffffff',
      nodeBorder: line,
      nodeTextColor: NAVY,
      // Edges match the branch lines.
      lineColor: line,
      edgeLabelBackground: '#ffffff',
      // Subgraphs read as the grouping plates: light wash, fainter border, tinted title.
      clusterBkg: tint,
      clusterBorder: 'rgba(15,30,77,0.16)',
      titleColor: text,
      secondaryColor: LIGHT,
      tertiaryColor: '#ffffff',
      tertiaryBorderColor: 'rgba(15,30,77,0.14)',
      textColor: INK,
      labelBoxBorderColor: line,
      arrowheadColor: line,
    },
    flowchart: {
      curve: 'basis',
      htmlLabels: true,
      padding: 12,
      nodeSpacing: 34,
      rankSpacing: 46,
      // false: keep the diagram's natural width so wide architecture charts can scroll instead of
      // being squeezed to unreadable text. The wrapper below scales it down to fit until expanded.
      useMaxWidth: false,
    },
  }
}

export function Mermaid({ code, accent = NAVY, title }) {
  const [svg, setSvg] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)
  // mermaid needs a unique id it can use as a DOM/CSS selector while measuring. useId gives a stable
  // per-instance one; its colons are stripped because they are not valid in a CSS selector.
  const domId = `st-mermaid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  useEffect(() => {
    let alive = true
    // setState only from the async callback, never synchronously in the effect body.
    ;(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize(themeFor(accent))
        const { svg: out } = await mermaid.render(domId, code)
        if (alive) setSvg(out)
      } catch (e) {
        // A malformed diagram must not take the document down with it — fall back to the source.
        if (alive) setError(e?.message || String(e))
      }
    })()
    return () => {
      alive = false
    }
    // domId is stable for the life of the component (useId), so it never actually retriggers this —
    // listed to satisfy the exhaustive-deps rule rather than because it can change.
  }, [code, accent, domId])

  if (error) {
    return (
      <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--light)] p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">
          diagram could not be drawn
        </div>
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-[var(--ink-2)]">
          {code}
        </pre>
      </div>
    )
  }

  return (
    <figure className="mb-4 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      <figcaption className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--light)] px-3 py-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Workflow className="h-3.5 w-3.5 flex-none text-[var(--c-text)]" strokeWidth={2.2} />
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3)]">
            {title || 'diagram'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-[var(--ink-3)] hover:text-[var(--navy)] transition-colors cursor-pointer select-none px-2 py-0.5 rounded border border-[var(--line)] bg-white/80 hover:bg-white"
        >
          {expanded ? 'Fit view' : 'Expand'}
        </button>
      </figcaption>

      <div
        className={cn(
          'p-3',
          // Fitted: the SVG scales down to the column width (never up past its natural size).
          // Expanded: natural size, scroll to read it — which is the only way a wide architecture
          // chart stays legible in a side panel.
          expanded ? 'overflow-auto [&_svg]:max-w-none' : 'overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full'
        )}
      >
        {svg == null ? (
          <div className="flex h-24 items-center justify-center text-[11px] uppercase tracking-[0.1em] text-[var(--ink-3)]">
            drawing diagram…
          </div>
        ) : (
          // mermaid returns a complete <svg> string; it is sanitised by securityLevel: 'strict'.
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>
    </figure>
  )
}
