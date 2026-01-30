import Plausible from 'plausible-tracker'

export const plausible = Plausible({
  domain: window.location.hostname,
  apiHost: '/proxy/plausible',
  trackLocalhost: import.meta.env.VITE_PLAUSIBLE_TRACK_LOCALHOST === 'true'
})

export function usePlausible() {
  return plausible.trackEvent
}
