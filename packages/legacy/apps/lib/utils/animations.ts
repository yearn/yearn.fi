export const transition = { duration: 0.1, ease: [0.42, 0, 0.58, 1] as const }

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
