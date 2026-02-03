import { init, track } from '@plausible-analytics/tracker'

init({
  domain: 'yearn.fi',
  endpoint: '/proxy/plausible/api/event',
  captureOnLocalhost: import.meta.env.VITE_PLAUSIBLE_TRACK_LOCALHOST === 'true',
  autoCapturePageviews: true
})

export function usePlausible() {
  return track
}
