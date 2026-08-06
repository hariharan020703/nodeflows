import * as React from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { cn } from '../../lib/utils.js'

// shadcn ScrollArea. Worth having over `overflow-y-auto` here because the panel's scrollbar sits on
// a white card inside a rounded container: the native one cuts the corner radius and changes width
// between platforms, this one is a thin brand-tinted overlay that only appears while scrolling.
const ScrollArea = React.forwardRef(({ className, children, viewportClassName, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
    <ScrollAreaPrimitive.Viewport className={cn('h-full w-full rounded-[inherit]', viewportClassName)}>
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2 border-l border-l-transparent p-[2px]',
      orientation === 'horizontal' && 'h-2 flex-col border-t border-t-transparent p-[2px]',
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-[rgba(15,30,77,0.22)] hover:bg-[rgba(15,30,77,0.34)]" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
