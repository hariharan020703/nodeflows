import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn's standard class combiner: clsx resolves conditionals, twMerge drops earlier Tailwind
// utilities that a later one overrides, so a `className` prop can always win over a component's
// defaults without !important.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
