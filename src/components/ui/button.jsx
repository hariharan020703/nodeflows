import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils.js'

// shadcn Button, with its palette swapped for this app's brand tokens instead of shadcn's default
// slate/zinc scale — so a button in the panel is the same navy/blue as the rest of the UI.
//
// `brand` is the department-tinted variant: --c is the department's own accent (set on .st-app and
// per-department inline), and --c-text / --c-line are the legibility-corrected derivations of it the
// canvas already uses. That is what ties a panel button to the branch it was opened from.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-bold tracking-wide transition-all duration-200 cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-2 active:scale-[0.98]',
  {
    variants: {
      variant: {
        // Solid navy — matches a selected node on the canvas (.st-node-deployed).
        default:
          'bg-[var(--navy)] text-white border border-[var(--navy)] hover:bg-[color-mix(in_srgb,var(--navy)_88%,white)] shadow-sm',
        // Department accent, for the primary action in a panel.
        brand:
          'text-white shadow-sm border bg-[var(--c,#0f1e4d)] border-[var(--c-line,#0f1e4d)] hover:brightness-[1.08]',
        // Quiet default: white card surface with a hairline border, tinting on hover.
        outline:
          'bg-white text-[var(--text,#2c2c2c)] border border-[var(--line,rgba(15,30,77,0.14))] hover:border-[var(--c-line)] hover:text-[var(--c-text)] hover:bg-[color-mix(in_srgb,var(--c)_5%,white)]',
        subtle:
          'bg-[var(--light,#f5f7fa)] text-[var(--ink-2,#5a6b8c)] border border-[var(--line,rgba(15,30,77,0.14))] hover:text-[var(--navy)] hover:bg-white',
        ghost: 'bg-transparent text-[var(--ink-2,#5a6b8c)] hover:text-[var(--blue)]',
      },
      size: {
        default: 'h-9 px-3.5 text-xs',
        sm: 'h-7 px-2.5 text-[10.5px]',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = 'Button'

// Only the component is exported: this project's react-refresh lint rule requires a module to
// export components alone, so `buttonVariants` stays internal (shadcn exports it by default — if you
// ever need it elsewhere, move it to its own module rather than re-exporting from here).
export { Button }
