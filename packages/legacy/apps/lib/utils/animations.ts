export const transition = { duration: 0.1, ease: 'easeInOut' }

export const variants = {
  initial: { y: 0, opacity: 0, transition },
  enter: { y: 0, opacity: 1, transition },
  exit: { y: 0, opacity: 0, transition }
}

export const TABS_VARIANTS = {
  initial: { y: 0, opacity: 0, transition },
  enter: { y: 0, opacity: 1, transition },
  exit: { y: 0, opacity: 0, transition }
}
