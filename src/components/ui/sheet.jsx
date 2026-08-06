import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils.js'

// shadcn Sheet (Radix Dialog), restyled onto this app's surfaces: the light canvas wash, hairline
// navy borders and the same panel entrance the old .st-side card used.
//
// Two things here are load-bearing rather than cosmetic:
//
// 1. `container` — the brand palette (--navy, --line, --c-text, ...) is declared on `.st-app`, so a
//    portal to document.body lands OUTSIDE it and every one of those vars resolves to nothing. That
//    is why this panel could only be styled in Tailwind's slate scale before. Portaling into
//    `.st-app` puts the panel back inside the cascade and the brand tokens work. `.st-app` carries
//    no transform, so `position: fixed` still resolves against the viewport.
//
// 2. The animation — `animate-slideInRight` / `animate-fadeIn` were referenced here but never
//    defined in tailwind.config.js, so the panel appeared with no transition at all. It now uses
//    `st-side-in`, which IS defined and is the exact entrance the canvas's own side panel used.
const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-40',
      'bg-[radial-gradient(ellipse_70%_65%_at_50%_56%,rgba(245,247,250,0.6)_0%,rgba(15,30,77,0.18)_100%)]',
      'backdrop-blur-[2px]',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const sideClasses = {
  right: 'inset-y-0 right-0 h-full w-[50vw] max-w-[50vw]',
  left: 'inset-y-0 left-0 h-full w-[50vw] max-w-[50vw]',
  top: 'inset-x-0 top-0',
  bottom: 'inset-x-0 bottom-0',
}

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

const SIDEBAR_STARS = (() => {
  const rnd = mulberry32(108)
  const stars = []
  for (let i = 0; i < 50; i++) {
    stars.push({
      left: rnd() * 100,
      top: rnd() * 100,
      size: rnd() < 0.6 ? 1.8 : rnd() < 0.88 ? 2.8 : 3.8,
      opacity: 0.25 + rnd() * 0.45,
      delay: rnd() * 6,
      duration: 4 + rnd() * 5,
    })
  }
  return stars
})()

const SheetContent = React.forwardRef(
  ({ side = 'right', className, children, container, showClose = true, ...props }, ref) => (
    <SheetPortal container={container}>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden',
          /* ─── frosted glass surface that matches the canvas ─── */
          'bg-[rgba(245,247,250,0.55)] backdrop-blur-2xl',
          'border-l border-[color-mix(in_srgb,var(--c,#1e84c4)_20%,rgba(15,30,77,0.12))]',
          'shadow-[inset_1px_0_0_rgba(255,255,255,0.6),0_0_80px_-20px_color-mix(in_srgb,var(--c,#1e84c4)_35%,rgba(15,30,77,0.25))]',
          'animate-st-side-in',
          sideClasses[side] || sideClasses.right,
          className
        )}
        {...props}
      >
        {/* ─── Same dot-grid veil the main canvas uses ─── */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-100"
          style={{
            backgroundImage: `
              radial-gradient(circle, rgba(15,30,77,0.20) 1.2px, transparent 1.2px),
              radial-gradient(ellipse 80% 55% at 100% 0%, color-mix(in srgb, var(--c,#1e84c4) 22%, transparent), transparent 72%),
              radial-gradient(ellipse 70% 50% at 0% 100%, color-mix(in srgb, var(--c,#1e84c4) 14%, transparent), transparent 70%)`,
            backgroundSize: '14px 14px, cover, cover',
          }}
        />
        {/* ─── Twinkling Stars Layer matching main background ─── */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {SIDEBAR_STARS.map((s, i) => (
            <div
              key={i}
              className="st-bgstar"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                opacity: s.opacity,
                backgroundColor: 'var(--c, #1e84c4)',
                boxShadow: `0 0 ${s.size * 2}px var(--c, #1e84c4)`,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            />
          ))}
        </div>
        {/* ─── Subtle top edge glow in brand colour ─── */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--c,#1e84c4) 40%, white), transparent)' }}
        />
        <div className="relative z-[1] flex flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {showClose && (
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full',
              'border border-[color-mix(in_srgb,var(--c,#1e84c4)_20%,rgba(15,30,77,0.12))]',
              'bg-[rgba(245,247,250,0.85)] backdrop-blur-md text-[var(--ink-2,#5a6b8c)]',
              'shadow-[0_2px_8px_-2px_rgba(15,30,77,0.12)]',
              'transition-all duration-200 hover:scale-110 hover:rotate-90 hover:text-[var(--navy,#0f1e4d)] hover:border-[var(--c,#1e84c4)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
              'active:scale-95'
            )}
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
)
SheetContent.displayName = DialogPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-2 text-left', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 border-t border-[var(--line,rgba(15,30,77,0.14))] pt-4 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

// Georgia, uppercase, widely tracked — the same lockup the wheel's department names and the fan's
// root name use, which is the strongest single cue that this panel belongs to that UI.
const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "font-['Georgia',_'Times_New_Roman',_serif] text-[19px] uppercase tracking-[0.12em] text-[var(--navy,#0f1e4d)]",
      className
    )}
    {...props}
  />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-[12.5px] leading-relaxed text-[var(--ink-2,#5a6b8c)]', className)}
    {...props}
  />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
