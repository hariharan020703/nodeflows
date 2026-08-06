import { useEffect, useMemo, useState } from 'react'
import { childrenOf, collectJsonFiles, jsonBundle, layoutRepo, loadText, nodeAt } from './repoData.js'
import { svgIcon } from './icons.js'
import { downloadBlob, makeZip } from './zip.js'
import { Braces, ChevronDown, ChevronRight, ChevronUp, Download, FileText } from 'lucide-react'
import { cn } from '../lib/utils.js'
import { Mermaid } from '../components/Mermaid.jsx'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet.jsx'
import { Badge } from '../components/ui/badge.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card, CardLabel, CardTitle } from '../components/ui/card.jsx'
import { ScrollArea } from '../components/ui/scroll-area.jsx'
import { Separator } from '../components/ui/separator.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.jsx'

function nodeClass(depth, isFile) {
  if (isFile) return 'st-fnode'
  if (depth === 0) return 'st-bnode st-node-dev'
  if (depth === 1) return 'st-anode'
  return 'st-anode'
}

function shortLabel(name) {
  const cleanName = name.replace(/\.[^/.]+$/, '')
  return cleanName.length > 22 ? `${cleanName.slice(0, 21)}…` : cleanName
}

function isNodeActive(n, openPath, filePath) {
  if (openPath.length === 0) return true
  const isFile = n.node.type === 'file'
  if (isFile) return filePath === n.path

  if (n.depth < openPath.length) {
    return openPath[n.depth] === n.node.name
  }
  if (n.depth === openPath.length) {
    return n.path.startsWith(openPath.join('/'))
  }
  return false
}

function isEdgeActive(e, openPath, filePath) {
  if (openPath.length === 0) return true
  return isNodeActive(e.to, openPath, filePath)
}

export function RepoFan({ dept, openPath, filePath, onPickNode, revealed }) {
  const { nodes, edges } = layoutRepo(openPath)
  const xs = [0, ...nodes.map((n) => n.left)]
  const ys = [0, ...nodes.map((n) => n.top)]
  const minX = Math.min(...xs) - 420
  const maxX = Math.max(...xs) + 420
  const minY = Math.min(...ys) - 420
  const maxY = Math.max(...ys) + 420
  const anyOpen = openPath.length > 0

  return (
    <div className={`st-fan ${revealed ? 'revealed' : ''} ${anyOpen ? 'focused' : ''}`} style={{ '--c': dept.color }}>
      <div className="st-ghost">{dept.name}</div>

      <svg className="st-lines" style={{ left: minX, top: minY, width: maxX - minX, height: maxY - minY }}>
        <g transform={`translate(${-minX},${-minY})`}>
          <g className="st-baselines">
            {edges.filter((e) => e.depth === 0).map((e) => {
              const activeEdge = isEdgeActive(e, openPath, filePath)
              const mx = e.to.left * 0.45
              const my = e.to.top * 0.45
              const len = Math.hypot(e.to.left, e.to.top) || 1
              const px = (-e.to.top / len) * 26
              const py = (e.to.left / len) * 26
              return (
                <g key={e.to.path}>
                  <path className={`st-drawline ${activeEdge ? '' : 'st-drawline-faded'}`} style={{ '--d': `${e.i * 0.08}s` }} d={`M 0 0 L ${e.to.left} ${e.to.top}`} pathLength="1" />
                  <g className={`st-edge-marker ${activeEdge ? '' : 'st-edge-faded'}`} style={{ '--d': `${e.i * 0.08 + 0.3}s` }}>
                    <line x1={mx} y1={my} x2={mx + px} y2={my + py} />
                    <circle cx={mx + px} cy={my + py} r="7" />
                  </g>
                </g>
              )
            })}
          </g>

          <g className="st-grow">
            {edges.filter((e) => e.depth > 0).map((e) => {
              const activeEdge = isEdgeActive(e, openPath, filePath)
              return (
                <path
                  key={e.to.path}
                  className={`st-drawline ${e.depth === 1 ? 'st-drawline-agent' : 'st-drawline-facet'} ${activeEdge ? '' : 'st-drawline-faded'}`}
                  style={{ '--d': `${e.i * 0.05}s` }}
                  d={`M ${e.from.left} ${e.from.top} L ${e.to.left} ${e.to.top}`}
                  pathLength="1"
                />
              )
            })}
          </g>
        </g>
      </svg>

      <div className="st-root-badge" dangerouslySetInnerHTML={{ __html: svgIcon(dept.icon) }} />
      <div className="st-root-name">{dept.name}</div>

      {nodes.map((n, i) => {
        const isFile = n.node.type === 'file'
        const activeNode = isNodeActive(n, openPath, filePath)
        const selectedNode = isFile ? filePath === n.path : n.open
        const fadedNode = !activeNode
        const kids = isFile ? 0 : childrenOf(n.node).length
        return (
          <button
            key={n.path}
            className={`st-node ${nodeClass(n.depth, isFile)} ${selectedNode ? 'selected' : ''} ${fadedNode ? 'faded' : ''}`}
            style={{ left: n.left, top: n.top, '--d': `${0.3 + i * 0.04}s` }}
            onClick={() => onPickNode(n)}
            title={n.node.name.replace(/\.[^/.]+$/, '')}
          >
            <span className="st-node-icon" dangerouslySetInnerHTML={{ __html: svgIcon(n.node.icon) }} />
            <span className="st-nlabel">{shortLabel(n.node.name)}</span>
            {kids > 0 && <span className="st-nkids">{kids}</span>}
          </button>
        )
      })}
    </div>
  )
}

// --- sidebar ----------------------------------------------------------------------------------

// `accent` is the department colour, threaded through so a ```mermaid block can draw its diagram in
// the same hues as the branch it was opened from. `docTitle` names the diagram in its caption.
function renderInline(text) {
  if (!text) return null
  const tokens = []
  let key = 0
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let lastIdx = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(text.slice(lastIdx, match.index))
    }
    const token = match[0]
    if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={key++}
          className="mx-0.5 inline-block rounded-md border border-[color-mix(in_srgb,var(--c)_22%,rgba(15,30,77,0.12))] bg-[color-mix(in_srgb,var(--c)_7%,rgba(245,247,250,0.95))] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--navy)] shadow-[0_1px_2px_rgba(15,30,77,0.04)]"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={key++} className="font-bold text-[var(--navy)]">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={key++} className="italic text-[var(--ink-2)]">
          {token.slice(1, -1)}
        </em>
      )
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        tokens.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--c-text)] underline underline-offset-2 transition-colors hover:text-[var(--navy)]"
          >
            {linkMatch[1]}
          </a>
        )
      } else {
        tokens.push(token)
      }
    } else {
      tokens.push(token)
    }
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) {
    tokens.push(text.slice(lastIdx))
  }
  return tokens
}

function Markdown({ text, accent, docTitle }) {
  const out = []
  const lines = text.split(/\r?\n/)
  let fence = null
  let fenceLang = ''
  let diagrams = 0

  const codeBlock = (key, body, lang) => (
    <div
      key={key}
      className="my-3.5 max-w-full overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--c)_18%,rgba(15,30,77,0.12))] bg-[#0f172a] shadow-md"
    >
      <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/80 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>{lang || 'code'}</span>
        <span className="h-2 w-2 rounded-full bg-indigo-400/80 shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
      </div>
      <pre className="max-w-full overflow-x-auto p-3.5 font-mono text-[11.5px] leading-relaxed text-slate-200 whitespace-pre-wrap break-all">
        {body}
      </pre>
    </div>
  )

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      if (fence) {
        const body = fence.join('\n')
        if (fenceLang === 'mermaid') {
          diagrams += 1
          out.push(
            <Mermaid
              key={`m${i}`}
              code={body}
              accent={accent}
              title={docTitle ? `${docTitle} · diagram ${diagrams}` : `diagram ${diagrams}`}
            />
          )
        } else {
          out.push(codeBlock(`f${i}`, body, fenceLang))
        }
        fence = null
        fenceLang = ''
      } else {
        fence = []
        fenceLang = trimmed.slice(3).trim().toLowerCase()
      }
      i++
      continue
    }

    if (fence) {
      fence.push(line)
      i++
      continue
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableRows = []
      let j = i
      while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().includes('|')) {
        tableRows.push(lines[j].trim())
        j++
      }

      if (tableRows.length >= 2) {
        const parseRow = (r) =>
          r
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())

        const headerCols = parseRow(tableRows[0])
        const isDelimiter = /^\|?\s*[-:]+[-|\s:]*$/.test(tableRows[1])
        const dataRows = (isDelimiter ? tableRows.slice(2) : tableRows.slice(1)).map(parseRow)

        out.push(
          <div
            key={`tbl-${i}`}
            className="my-4 max-w-full overflow-x-auto rounded-xl border border-[color-mix(in_srgb,var(--c)_18%,rgba(15,30,77,0.12))] bg-white/90 shadow-[0_4px_16px_-4px_rgba(15,30,77,0.06)] backdrop-blur-xs"
          >
            <table className="w-full border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--c)_15%,rgba(15,30,77,0.10))] bg-[color-mix(in_srgb,var(--c)_8%,rgba(245,247,250,0.95))]">
                  {headerCols.map((col, ci) => (
                    <th key={ci} className="px-3.5 py-2.5 font-bold uppercase tracking-[0.06em] text-[10px] text-[var(--navy)]">
                      {renderInline(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {dataRows.map((row, ri) => (
                  <tr key={ri} className="transition-colors hover:bg-[color-mix(in_srgb,var(--c)_4%,white)]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--ink-2)] align-top">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        i = j
        continue
      }
    }

    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '')
      out.push(
        <div
          key={`q-${i}`}
          className="my-4.5 flex gap-3.5 rounded-r-xl border-l-[4px] border-[var(--c-line)] bg-[color-mix(in_srgb,var(--c)_7%,rgba(255,255,255,0.85))] p-4 sm:p-4.5 text-[12.5px] leading-relaxed text-[var(--navy)] shadow-[0_2px_10px_-3px_rgba(15,30,77,0.05)]"
        >
          <div className="min-w-0 flex-1">{renderInline(quoteText)}</div>
        </div>
      )
      i++
      continue
    }

    if (/^(---|[*]{3,}|_{3,})$/.test(trimmed)) {
      out.push(
        <hr
          key={`hr-${i}`}
          className="my-6 border-0 h-[1px] bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--c)_25%,rgba(15,30,77,0.18))] to-transparent"
        />
      )
      i++
      continue
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      out.push(
        level === 1 ? (
          <div key={i} className="mb-4 mt-7 border-b border-[color-mix(in_srgb,var(--c)_16%,rgba(15,30,77,0.10))] pb-3 pt-1 first:mt-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3.5px] border-2 border-[color-mix(in_srgb,var(--c)_45%,rgba(15,30,77,0.2))] bg-white shadow-[0_0_6px_color-mix(in_srgb,var(--c)_20%,transparent)]">
                <span className="h-1.5 w-1.5 rounded-[1px] bg-[var(--c)] opacity-60" />
              </span>
              <h3 className="font-['Georgia',_'Times_New_Roman',_serif] text-[15.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--navy)]">
                {renderInline(h[2])}
              </h3>
            </div>
          </div>
        ) : level === 2 ? (
          <h4
            key={i}
            className="mb-3 mt-6 flex items-center gap-2.5 break-words text-[13px] font-extrabold uppercase tracking-[0.1em] text-[var(--navy)] py-0.5 first:mt-0"
          >
            <span className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3.5px] border-2 border-[color-mix(in_srgb,var(--c)_40%,rgba(15,30,77,0.18))] bg-white shadow-[0_0_5px_color-mix(in_srgb,var(--c)_15%,transparent)]">
              <span className="h-1.5 w-1.5 rounded-[1px] bg-[var(--c)] opacity-50" />
            </span>
            {renderInline(h[2])}
          </h4>
        ) : (
          <h5
            key={i}
            className="mb-2.5 mt-5 flex items-center gap-2 break-words text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)] py-0.5"
          >
            <span className="flex h-2.5 w-2.5 flex-none items-center justify-center rounded-[2.5px] border-[1.5px] border-[color-mix(in_srgb,var(--c)_35%,rgba(15,30,77,0.15))] bg-white">
              <span className="h-1 w-1 rounded-[0.5px] bg-[var(--c)] opacity-40" />
            </span>
            {renderInline(h[2])}
          </h5>
        )
      )
      i++
      continue
    }

    const b = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (b) {
      out.push(
        <div
          key={i}
          className="mb-2.5 flex items-start gap-3 px-1 py-0.5 text-[12.5px] leading-relaxed text-[var(--ink-2)] break-words min-w-0"
        >
          <span className="mt-[7.5px] h-[5px] w-[5px] flex-none rounded-full bg-[var(--c-line)] shadow-[0_0_6px_var(--c)]" />
          <span className="min-w-0 flex-1 break-words">{renderInline(b[1])}</span>
        </div>
      )
      i++
      continue
    }

    const num = /^\s*(\d+)\.\s+(.*)$/.exec(line)
    if (num) {
      out.push(
        <div
          key={i}
          className="mb-2.5 flex items-start gap-2 px-1 py-0.5 text-[12.8px] leading-[1.75] text-[var(--ink-2)] break-words min-w-0"
        >
          <span className="font-bold text-[var(--navy)] min-w-[18px] flex-none text-right pr-0.5 select-none font-mono">
            {num[1]}.
          </span>
          <span className="min-w-0 flex-1 break-words">{renderInline(num[2])}</span>
        </div>
      )
      i++
      continue
    }

    if (trimmed) {
      out.push(
        <p
          key={i}
          className="mb-3.5 px-0.5 py-0.5 text-[12.8px] leading-[1.75] text-[var(--text)] break-words min-w-0"
        >
          {renderInline(line)}
        </p>
      )
    }

    i++
  }

  if (fence) {
    out.push(
      fenceLang === 'mermaid' ? (
        <div
          key="f-last"
          className="mb-4 flex h-24 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[11px] uppercase tracking-[0.1em] text-[var(--ink-3)]"
        >
          preparing diagram…
        </div>
      ) : (
        codeBlock('f-last', fence.join('\n'), fenceLang)
      )
    )
  }

  return <div className="w-full max-w-full min-w-0 overflow-hidden break-words">{out}</div>
}

function TypewriterMarkdown({ text, accent, docTitle }) {
  const [wordIndex, setWordIndex] = useState(0)
  const [prevText, setPrevText] = useState(text)

  if (prevText !== text) {
    setPrevText(text)
    setWordIndex(0)
  }

  const words = useMemo(() => {
    if (!text) return []
    return text.split(/(\s+)/)
  }, [text])

  useEffect(() => {
    if (!words.length) return undefined

    const total = words.length
    const interval = 16 // 22ms per word = 45 words/sec single word-by-word streaming

    const timer = setInterval(() => {
      setWordIndex((prev) => {
        if (prev + 5 >= total) {
          clearInterval(timer)
          return total
        }
        return prev + 5
      })
    }, interval)

    return () => clearInterval(timer)
  }, [words])

  const visibleText = useMemo(() => {
    if (!words.length) return ''
    return words.slice(0, wordIndex).join('')
  }, [words, wordIndex])

  const isGenerating = words.length > 0 && wordIndex < words.length

  return (
    <div className="relative">
      <Markdown text={visibleText} accent={accent} docTitle={docTitle} />
      {isGenerating && (
        <span className="inline-block w-2 h-4 ml-1 bg-[var(--c-line)] animate-pulse rounded-xs align-middle" />
      )}
    </div>
  )
}

function TypewriterPre({ text }) {
  const [wordIndex, setWordIndex] = useState(0)
  const [prevText, setPrevText] = useState(text)

  if (prevText !== text) {
    setPrevText(text)
    setWordIndex(0)
  }

  const words = useMemo(() => {
    if (!text) return []
    return text.split(/(\s+)/)
  }, [text])

  useEffect(() => {
    if (!words.length) return undefined

    const total = words.length
    const interval = 22 // 22ms per word = 45 words/sec single word-by-word streaming

    const timer = setInterval(() => {
      setWordIndex((prev) => {
        if (prev + 1 >= total) {
          clearInterval(timer)
          return total
        }
        return prev + 1
      })
    }, interval)

    return () => clearInterval(timer)
  }, [words])

  const visibleText = useMemo(() => {
    if (!words.length) return ''
    return words.slice(0, wordIndex).join('')
  }, [words, wordIndex])

  const isGenerating = words.length > 0 && wordIndex < words.length

  return (
    <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-[var(--line)] bg-[var(--light)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ink-2)]">
      {visibleText}
      {isGenerating && (
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-[var(--c-line)] animate-pulse align-middle" />
      )}
    </pre>
  )
}

export function RepoSidebar({ dept, path, onClose }) {
  const node = nodeAt(path)
  const [text, setText] = useState(null)
  const [activeFileIndex, setActiveFileIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [exportExpanded, setExportExpanded] = useState(false)

  const isFile = node?.type === 'file'
  const mdFiles = useMemo(() => {
    if (!node) return []
    if (isFile) return [node]
    return (node.files || []).filter((f) => f.ext === 'md')
  }, [node, isFile])

  const jsonItems = useMemo(() => collectJsonFiles(node), [node])

  const [prevPath, setPrevPath] = useState(path)
  if (prevPath !== path) {
    setPrevPath(path)
    if (activeFileIndex !== 0) setActiveFileIndex(0)
    if (exportExpanded) setExportExpanded(false)
  }

  const currentFile = mdFiles[activeFileIndex] || mdFiles[0] || null

  const [prevFile, setPrevFile] = useState(currentFile)
  if (prevFile !== currentFile) {
    setPrevFile(currentFile)
    setText(null)
  }

  useEffect(() => {
    if (!currentFile) return undefined
    let alive = true
    loadText(currentFile).then((t) => {
      if (alive) setText(t)
    })
    return () => {
      alive = false
    }
  }, [currentFile])

  async function handleExport() {
    if (!node || jsonItems.length === 0) return
    setBusy(true)
    try {
      const files = await jsonBundle(node)
      if (files.length === 1) {
        const blob = new Blob([files[0].text], { type: 'application/json' })
        downloadBlob(blob, files[0].name)
      } else if (files.length > 1) {
        const zipBlob = makeZip(files)
        downloadBlob(zipBlob, `${node.name}.zip`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleSingleDownload(item) {
    try {
      const textContent = await item.file.load()
      const blob = new Blob([textContent], { type: 'application/json' })
      downloadBlob(blob, item.downloadName)
    } catch (err) {
      console.error('Failed to download file', err)
    }
  }

  const isOpen = Boolean(node && (mdFiles.length > 0 || jsonItems.length > 0))

  const crumb = path ? path.split('/') : []

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        container={document.querySelector('.st-app') || undefined}
        style={{ '--c': dept?.color || '#0070f3' }}
      >
        <SheetHeader className="relative flex-none gap-3 border-b border-[color-mix(in_srgb,var(--c)_18%,rgba(15,30,77,0.10))] bg-transparent px-6 pb-5 pr-16 pt-5 min-w-0 max-w-full overflow-hidden">
          <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)] min-w-0 max-w-full overflow-hidden">
            <span className="text-[var(--c-text)]">{dept?.name}</span>
            {crumb.map((part, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0 truncate">
                <ChevronRight className="h-3 w-3 flex-none opacity-50" />
                <span className={cn("truncate", i === crumb.length - 1 ? 'text-[var(--navy)]' : undefined)}>
                  {part.replace(/\.[^/.]+$/, '')}
                </span>
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-4 min-w-0 max-w-full">
            <span
              className="grid h-[62px] w-[62px] flex-none place-items-center rounded-full border-[3px] border-[var(--c-line)] text-[var(--c-text)] [&_svg]:h-7 [&_svg]:w-7 backdrop-blur-md"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.75), rgba(245,247,250,0.55))',
                boxShadow: '0 0 44px -10px var(--c)',
              }}
              dangerouslySetInnerHTML={{ __html: svgIcon(node?.icon) }}
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <SheetTitle className="truncate">{node?.name ? node.name.replace(/\.[^/.]+$/, '') : ''}</SheetTitle>
            </div>
          </div>
          <SheetDescription className="sr-only">
            File details and document content for {node?.name ? node.name.replace(/\.[^/.]+$/, '') : ''}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={String(activeFileIndex)}
          onValueChange={(v) => setActiveFileIndex(Number(v))}
          orientation="vertical"
          className="flex min-h-0 flex-1 flex-row overflow-hidden min-w-0 max-w-full"
        >
          {mdFiles.length > 1 && (
            <TabsList
              orientation="vertical"
              className="flex-none items-center gap-3 overflow-y-auto border-r border-[color-mix(in_srgb,var(--c)_14%,rgba(15,30,77,0.08))] bg-[rgba(245,247,250,0.45)] px-3 py-6 select-none"
            >
              {mdFiles.map((file, idx) => (
                <TabsTrigger
                  key={file.path}
                  value={String(idx)}
                  title={file.name.replace(/\.[^/.]+$/, '')}
                  className={cn(
                    "flex flex-col items-center justify-center py-4 px-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-xs font-bold",
                    "border-[color-mix(in_srgb,var(--c)_12%,rgba(15,30,77,0.08))] text-[var(--ink-2)] bg-[rgba(245,247,250,0.65)] hover:bg-[rgba(245,247,250,0.9)] hover:text-[var(--navy)]",
                    "data-[state=active]:bg-[color-mix(in_srgb,var(--c)_12%,rgba(245,247,250,0.95))] data-[state=active]:text-[var(--navy)] data-[state=active]:border-[var(--c-line)] data-[state=active]:shadow-[0_4px_14px_-3px_color-mix(in_srgb,var(--c)_30%,transparent)]"
                  )}
                >
                  <span className="whitespace-nowrap text-[11px] font-sans tracking-wider uppercase [writing-mode:vertical-rl] [transform:rotate(180deg)] py-1">
                    {file.name.replace(/\.[^/.]+$/, '')}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          <ScrollArea className="min-w-0 flex-1 max-w-full overflow-hidden" viewportClassName="px-6 py-6 max-w-full overflow-x-hidden">
            <div className="relative min-w-0 max-w-full overflow-hidden space-y-6">

            {jsonItems.length > 0 && (
              <Card className="w-full max-w-full overflow-hidden bg-[rgba(245,247,250,0.75)] border border-[color-mix(in_srgb,var(--c)_14%,rgba(15,30,77,0.09))] shadow-[0_4px_20px_-6px_rgba(15,30,77,0.06)] [transform:translateZ(0)]">
                <div className="flex items-center justify-between gap-3 p-4 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <CardLabel>json export</CardLabel>
                    <CardTitle className="truncate">
                      {jsonItems.length} file{jsonItems.length === 1 ? '' : 's'}
                      <span className="ml-1.5 font-normal text-[var(--ink-3)] truncate">
                        {jsonItems.length === 1 ? '· direct download' : `· zipped as ${node?.name}.zip`}
                      </span>
                    </CardTitle>
                  </div>
                  <Button variant="brand" onClick={handleExport} disabled={busy} className="flex-none uppercase">
                    <Download className="h-3.5 w-3.5" strokeWidth={2.4} />
                    {busy ? 'Packing…' : jsonItems.length === 1 ? 'Download' : 'Export zip'}
                  </Button>
                </div>

                <Separator />

                <button
                  type="button"
                  className="flex w-full cursor-pointer select-none items-center justify-between px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-2)] transition-colors hover:text-[var(--navy)]"
                  onClick={() => setExportExpanded((v) => !v)}
                >
                  <span className="flex items-center gap-1.5">
                    files to export
                    <Badge variant="default">{jsonItems.length}</Badge>
                  </span>
                  <span className="flex items-center gap-1 normal-case tracking-normal text-[var(--ink-3)]">
                    {exportExpanded ? 'Hide' : 'Show'}
                    {exportExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.4} />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.4} />
                    )}
                  </span>
                </button>

                {exportExpanded && (
                  <div className="relative max-h-56 overflow-y-auto border-t border-[var(--line)] bg-white p-3 max-w-full">
                    <div className="space-y-1.5 max-w-full">
                    {jsonItems.map((item, i) => (
                      <div
                        key={i}
                        className="relative flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-white p-2 pl-2.5 transition-colors hover:border-[var(--c-line)] hover:bg-[color-mix(in_srgb,var(--c)_5%,white)] max-w-full overflow-hidden"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                          <Braces className="h-4 w-4 flex-none text-[var(--c-text)]" strokeWidth={2} />
                          <div className="min-w-0 flex-1 truncate">
                            <div className="truncate font-mono text-[11px] font-bold text-[var(--navy)]">
                              {item.downloadName}
                            </div>
                            {item.folderName && item.folderName !== node?.name && (
                              <div className="truncate text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-3)]">
                                from {item.folderName}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-none uppercase text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSingleDownload(item)
                          }}
                          title={`Download ${item.downloadName}`}
                        >
                          <Download className="h-3 w-3" strokeWidth={2.4} />
                          Save
                        </Button>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {currentFile && (
              <TabsContent value={String(activeFileIndex)} forceMount>
                <Card className="w-full max-w-full overflow-hidden bg-[rgba(245,247,250,0.88)] p-6 sm:p-7.5 border border-[color-mix(in_srgb,var(--c)_16%,rgba(15,30,77,0.10))] shadow-[0_8px_30px_-8px_rgba(15,30,77,0.08)] backdrop-blur-md [transform:translateZ(0)]">
                  <div className="mb-5 flex items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--c)_15%,rgba(15,30,77,0.08))] pb-4 px-1 min-w-0 max-w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid h-7.5 w-7.5 flex-none place-items-center rounded-lg bg-[color-mix(in_srgb,var(--c)_12%,rgba(245,247,250,0.9))] text-[var(--navy)] shadow-xs">
                        <FileText className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="truncate text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--navy)] min-w-0">
                        {currentFile.name.replace(/\.[^/.]+$/, '')}
                      </span>
                    </div>
                    <Badge variant="secondary" className="flex-none uppercase text-[9.5px] tracking-wider px-2.5 py-0.5 bg-white/80 border border-[color-mix(in_srgb,var(--c)_20%,transparent)] text-[var(--c-text)] font-semibold">
                      {currentFile.ext === 'md' ? 'Document' : currentFile.ext.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="px-1.5 py-1">
                  {text == null ? (
                    <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-3)] py-8 justify-center">
                      <span className="h-2 w-2 rounded-full bg-[var(--c-line)] animate-ping" />
                      Loading document content…
                    </div>
                  ) : currentFile.ext === 'md' ? (
                    <TypewriterMarkdown
                      text={text}
                      accent={dept?.color}
                      docTitle={currentFile.name.replace(/\.[^/.]+$/, '')}
                    />
                  ) : (
                    <TypewriterPre text={text} />
                  )}
                  </div>
                </Card>
              </TabsContent>
            )}
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

export function RepoZipExportBar({ folderNode, dept, hasSidebar, isRoot }) {
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const [prevFolderPath, setPrevFolderPath] = useState(folderNode?.path)
  if (prevFolderPath !== folderNode?.path) {
    setPrevFolderPath(folderNode?.path)
    if (expanded) setExpanded(false)
  }

  const jsonItems = useMemo(
    () => collectJsonFiles(folderNode),
    [folderNode]
  )

  if (!folderNode || isRoot || jsonItems.length === 0) return null

  const isSingle = jsonItems.length === 1
  const folderName = folderNode.name

  async function handleDownload(e) {
    e.stopPropagation()
    setBusy(true)
    try {
      const files = await jsonBundle(folderNode)
      if (files.length === 1) {
        // Single file: download raw file without zipping
        const blob = new Blob([files[0].text], { type: 'application/json' })
        downloadBlob(blob, files[0].name)
      } else if (files.length > 1) {
        // Multiple files: package as zip folder
        const zipBlob = makeZip(files)
        downloadBlob(zipBlob, `${folderName}.zip`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`st-zip-bar ${expanded ? 'expanded' : ''}`}
      style={{
        '--c': dept?.color || '#0f1e4d',
        right: hasSidebar ? '440px' : '20px',
        cursor: 'pointer',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        setExpanded((prev) => !prev)
      }}
    >
      <div className="st-zip-header">
        <div className="st-zip-info">
          <span className="st-zip-icon" dangerouslySetInnerHTML={{ __html: svgIcon(folderNode.icon || 'folder') }} />
          <div className="st-zip-text">
            <div className="st-zip-title">{folderName}</div>
            <div className="st-zip-sub">
              {jsonItems.length} JSON file{jsonItems.length === 1 ? '' : 's'} · {isSingle ? 'Direct File' : 'ZIP Folder'} <span style={{ marginLeft: 4 }}>{expanded ? '▴' : '▾'}</span>
            </div>
          </div>
        </div>

        <button className="st-zip-btn" onClick={handleDownload} disabled={busy}>
          {busy ? (
            'DOWNLOADING…'
          ) : isSingle ? (
            `⬇ DOWNLOAD`
          ) : (
            `⬇ EXPORT ZIP`
          )}
        </button>
      </div>

      {expanded && (
        <div className="st-zip-filelist">
          <div className="st-zip-filelist-title">Files to download:</div>
          <div className="st-zip-file-items">
            {jsonItems.map((item, idx) => (
              <div key={idx} className="st-zip-file-item">
                <span className="st-zip-file-icon">📄</span>
                <span className="st-zip-file-name">{item.downloadName}</span>
                <span className="st-zip-file-tag">json</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
