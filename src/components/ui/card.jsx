import * as React from 'react'
import { cn } from '../../lib/utils.js'

// shadcn Card with this app's surface treatment: white on the light canvas, a hairline navy border
// (--line) rather than shadcn's grey, and the same 12px inner radius the canvas nodes and item rows
// use. No heavy shadow — the panel it sits in already carries the elevation.
const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl border border-[var(--line,rgba(15,30,77,0.14))] bg-white text-[var(--text,#2c2c2c)]',
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />
))
CardHeader.displayName = 'CardHeader'

// Section headings across this app are small, uppercase and widely tracked (.st-side-h) rather than
// large and bold — that is what makes a panel read as part of the canvas UI.
const CardLabel = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3,#8a99b5)]',
      className
    )}
    {...props}
  />
))
CardLabel.displayName = 'CardLabel'

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm font-bold text-[var(--navy,#0f1e4d)]', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-4 pt-0', className)} {...props} />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardLabel, CardTitle, CardContent, CardFooter }
