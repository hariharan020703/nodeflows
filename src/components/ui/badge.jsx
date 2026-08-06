import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils.js'

// shadcn Badge, sized and coloured to match the canvas's own pills (.st-ipill / .st-nkids): 9-10px,
// uppercase, wide tracking, pill radius. `brand` picks up the department tint; `count` is the
// filled circle-ish counter used next to a title.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-[0.07em] whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[rgba(15,30,77,0.06)] text-[var(--ink-2,#5a6b8c)]',
        brand:
          'border-[var(--c-line)] text-[var(--c-text)] bg-[color-mix(in_srgb,var(--c)_14%,white)]',
        solid: 'border-transparent bg-[var(--navy)] text-white',
        info: 'border-transparent bg-[rgba(30,132,196,0.12)] text-[var(--blue,#1e84c4)]',
        muted: 'border-transparent bg-transparent text-[var(--ink-3,#8a99b5)]',
        outline:
          'border-[var(--line,rgba(15,30,77,0.14))] text-[var(--ink-2,#5a6b8c)] bg-white',
      },
      size: {
        default: 'px-2 py-[3px] text-[9px]',
        md: 'px-2.5 py-1 text-[10.5px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const Badge = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
))
Badge.displayName = 'Badge'

// Component-only export, same reason as button.jsx: the react-refresh rule here rejects a module
// that exports both a component and a constant.
export { Badge }
