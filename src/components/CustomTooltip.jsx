import { useEffect, useState } from 'react'

export function CustomTooltip() {
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    let currentTarget = null

    const handleMouseOver = (e) => {
      const target = e.target.closest('[title], [data-tooltip]')
      if (!target) {
        setTooltip(null)
        currentTarget = null
        return
      }

      let text = target.getAttribute('data-tooltip')
      if (!text && target.hasAttribute('title')) {
        text = target.getAttribute('title')
        if (text) {
          target.setAttribute('data-tooltip', text)
          target.removeAttribute('title') // Suppress native browser tooltip
        }
      }

      if (!text) {
        setTooltip(null)
        return
      }

      currentTarget = target
      const rect = target.getBoundingClientRect()
      setTooltip({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top,
      })
    }

    const handleMouseMove = () => {
      if (!currentTarget) return
      const rect = currentTarget.getBoundingClientRect()
      setTooltip((prev) => (prev ? {
        ...prev,
        x: rect.left + rect.width / 2,
        y: rect.top,
      } : null))
    }

    const handleMouseOut = (e) => {
      if (currentTarget && (!e.relatedTarget || !currentTarget.contains(e.relatedTarget))) {
        setTooltip(null)
        currentTarget = null
      }
    }

    const handleScrollOrClick = () => {
      setTooltip(null)
      currentTarget = null
    }

    document.addEventListener('mouseover', handleMouseOver, { passive: true })
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseout', handleMouseOut, { passive: true })
    window.addEventListener('scroll', handleScrollOrClick, { capture: true, passive: true })
    window.addEventListener('click', handleScrollOrClick, { passive: true })

    return () => {
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseout', handleMouseOut)
      window.removeEventListener('scroll', handleScrollOrClick, { capture: true })
      window.removeEventListener('click', handleScrollOrClick)
    }
  }, [])

  if (!tooltip || !tooltip.text) return null

  return (
    <div
      className="fixed z-[99999] pointer-events-none -translate-x-1/2 -translate-y-[calc(100%+8px)] animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
    >
      <div className="relative rounded-md bg-slate-900/90 backdrop-blur-md px-3 py-1.5 text-[11px] font-semibold text-slate-100 shadow-[0_10px_30px_-5px_rgba(15,30,77,0.4)] border border-slate-700/60 tracking-wide whitespace-nowrap">
        {tooltip.text}
        <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-slate-900/90" />
      </div>
    </div>
  )
}
