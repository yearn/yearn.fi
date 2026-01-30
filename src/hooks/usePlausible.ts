import Plausible from 'plausible-tracker'

export const plausible = Plausible({
  domain: 'yearnfi-git-measure-yearn.vercel.app',
  apiHost: '/proxy/plausible',
  trackLocalhost: import.meta.env.VITE_PLAUSIBLE_TRACK_LOCALHOST === 'true'
})

export function usePlausible() {
  return plausible.trackEvent
}
