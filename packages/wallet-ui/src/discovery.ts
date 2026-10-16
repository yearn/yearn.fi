type TProviderDetail = {
  info: { rdns: string; uuid: string }
  provider: unknown
}

const DISCOVERY_KEY = Symbol.for('yearn.wallet-ui.discovery')
type TDiscoveryWindow = Window & { [DISCOVERY_KEY]?: () => void }

/** Keep one provider per wallet, matching our picker, before Wagmi consumes EIP-6963 announcements. */
export function deduplicateWalletAnnouncements(): (() => void) | undefined {
  if (typeof window === 'undefined') return undefined
  const browserWindow = window as TDiscoveryWindow
  if (browserWindow[DISCOVERY_KEY]) return browserWindow[DISCOVERY_KEY]

  // First provider per rdns wins for this page; a full reload picks up replacement extension sessions.
  const providers = new Map<string, TProviderDetail>()
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<TProviderDetail>).detail
    if (!detail?.info?.rdns || !detail.info.uuid || !detail.provider) return
    const existing = providers.get(detail.info.rdns)
    if (!existing) {
      providers.set(detail.info.rdns, detail)
      return
    }
    if (existing.info.uuid === detail.info.uuid && existing.provider === detail.provider) return

    event.stopImmediatePropagation()
    // Replay instead of dropping: a new discovery store still needs this wallet after a remount or HMR.
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: existing }))
  }
  const stop = () => {
    window.removeEventListener('eip6963:announceProvider', onAnnounce, true)
    delete browserWindow[DISCOVERY_KEY]
  }
  // A window singleton survives development reloads without stacking event handlers.
  browserWindow[DISCOVERY_KEY] = stop
  window.addEventListener('eip6963:announceProvider', onAnnounce, true)
  return stop
}
