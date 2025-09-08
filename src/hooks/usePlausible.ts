import Plausible from 'plausible-tracker'

const plausible = Plausible({
  domain: 'yearn.fi',
  apiHost: '/proxy/plausible'
})

export function usePlausible() {
  return plausible.trackEvent
}