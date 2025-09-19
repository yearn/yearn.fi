import Plausible from 'plausible-tracker'

const plausible = Plausible({
  domain: 'yearn.fi'
})

export function usePlausible() {
  return plausible.trackEvent
}
