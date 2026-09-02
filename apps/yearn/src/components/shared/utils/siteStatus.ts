import type { TSiteHealth, TSiteHealthState } from '@/types/siteStatus'

export function formatSiteStatusDate(value?: string): string {
  const date = new Date(value ?? '')
  if (!value || Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
    timeZoneName: 'short'
  }).format(date)
}

export function formatSiteStatusTime(value?: string): string {
  const date = new Date(value ?? '')
  if (!value || Number.isNaN(date.getTime())) {
    return 'unknown'
  }

  return `${new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC'
  }).format(date)} UTC`
}

export function getSiteHealthStateClassName(state?: TSiteHealthState): string {
  if (state === 'operational') {
    return 'bg-success'
  }
  if (state === 'degraded') {
    return 'bg-warning'
  }
  if (state === 'unavailable') {
    return 'bg-error'
  }
  return 'bg-text-tertiary'
}

export function getOverallSiteHealthState(health?: TSiteHealth): TSiteHealthState | undefined {
  if (!health) {
    return undefined
  }
  if (health.services.kong.state === 'operational' && health.services.rpc.state === 'operational') {
    return 'operational'
  }
  if (health.services.kong.state === 'unavailable' && health.services.rpc.state === 'unavailable') {
    return 'unavailable'
  }
  return 'degraded'
}

export function getSiteHealthStateLabel(state?: TSiteHealthState): string {
  if (!state) {
    return 'Checking'
  }
  return state.charAt(0).toUpperCase() + state.slice(1)
}
