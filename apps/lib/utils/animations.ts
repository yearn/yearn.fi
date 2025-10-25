import type { Transition, Variants } from 'framer-motion'

export const transition: Transition = { duration: 0.1, ease: 'easeInOut' }

export const variants: Variants = {
  initial: { y: 0, opacity: 0, transition },
  enter: { y: 0, opacity: 1, transition },
  exit: { y: 0, opacity: 0, transition }
}

export const TABS_VARIANTS: Variants = {
  initial: { y: 0, opacity: 0, transition },
  enter: { y: 0, opacity: 1, transition },
  exit: { y: 0, opacity: 0, transition }
}
