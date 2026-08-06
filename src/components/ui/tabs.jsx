import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils.js'

// shadcn Tabs, with a vertical variant for the panel's document rail. Radix brings the part that
// hand-rolled buttons were missing: roving focus, arrow-key navigation and the aria wiring between
// each tab and its panel.
//
// The active tab is solid navy with white text — deliberately the same treatment a selected node
// gets on the canvas (.st-node-deployed), so "this one is open" looks identical in both places.
const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, orientation = 'horizontal', ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex gap-2',
      orientation === 'vertical' ? 'flex-col' : 'flex-row items-center',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const triggerVariants = cva(
  'group cursor-pointer select-none font-bold uppercase tracking-[0.12em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        // The pill: a self-contained tab chip.
        default: cn(
          'inline-flex items-center justify-center gap-2 rounded-xl border',
          'border-[var(--line,rgba(15,30,77,0.14))] bg-[var(--light,#f5f7fa)] text-[var(--ink-2,#5a6b8c)]',
          'hover:bg-white hover:border-[var(--c-line)] hover:text-[var(--c-text)]',
          'data-[state=active]:bg-[var(--navy,#0f1e4d)] data-[state=active]:text-white data-[state=active]:border-[var(--navy,#0f1e4d)] data-[state=active]:shadow-sm'
        ),
        // Bare, so the trigger can BE a canvas node: the consumer draws its own circle + label and
        // reacts to state with `group-data-[state=active]:`. Used by the repo panel's document rail,
        // where a tab is meant to look like the nodes on the tree it came from.
        node: cn(
          'flex flex-col items-center gap-2.5 rounded-none border-0 bg-transparent p-0',
          'text-[var(--ink-2,#5a6b8c)] hover:text-[var(--c-text)] data-[state=active]:text-[var(--navy,#0f1e4d)]'
        ),
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const TabsTrigger = React.forwardRef(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={cn(triggerVariants({ variant }), className)} {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('min-w-0 focus-visible:outline-none', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
