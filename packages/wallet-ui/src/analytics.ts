export type TWalletAnalyticsProperties = Record<string, string | number | boolean>
export type TWalletAnalytics = (event: string, properties: TWalletAnalyticsProperties) => void
export type TWalletAnalyticsConnector = {
  name: string
  type: string
  getProvider?: () => Promise<unknown>
}
export type TWalletPath = 'detected' | 'walletconnect' | 'more_wallets'

const WALLET_NAMES = [
  ['rabby', 'rabby'],
  ['metamask', 'metamask'],
  ['walletchan', 'walletchan'],
  ['trust', 'trust'],
  ['binance', 'binance'],
  ['safepal', 'safepal'],
  ['tokenpocket', 'tokenpocket'],
  ['fireblocks', 'fireblocks'],
  ['ironwallet', 'ironwallet'],
  ['bitget', 'bitget'],
  ['okx', 'okx'],
  ['ledger', 'ledger'],
  ['safe', 'safe'],
  ['coinbase', 'coinbase'],
  ['rainbow', 'rainbow'],
  ['phantom', 'phantom'],
  ['zerion', 'zerion']
] as const

export function normalizeWalletName(name?: string): string {
  const normalized = name?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''
  return WALLET_NAMES.find(([match]) => normalized.includes(match))?.[1] ?? 'unknown'
}

export function connectionMethod(connector?: TWalletAnalyticsConnector): string {
  if (connector?.type === 'injected') return 'injected'
  if (connector?.type === 'walletConnect') return 'walletconnect'
  if (connector?.type === 'safe') return 'safe_sdk'
  return connector ? 'sdk' : 'unknown'
}

export function durationBucket(start: number): string {
  const elapsed = performance.now() - start
  if (elapsed < 1000) return '<1s'
  if (elapsed < 3000) return '1-3s'
  if (elapsed < 10000) return '3-10s'
  if (elapsed < 30000) return '10-30s'
  return '30s+'
}

// Only known categories leave the browser. Error messages can contain addresses and RPC URLs.
export function connectionErrorCategory(error: unknown, depth = 0): string {
  if (!error || typeof error !== 'object' || depth > 5) return 'unknown'
  const { code, name, message, cause } = error as { code?: number; name?: string; message?: string; cause?: unknown }
  if (code === 4001 || code === 5000 || /UserRejected|rejected|denied|cancelled|canceled/i.test(`${name} ${message}`))
    return 'rejected'
  if (code === -32002) return 'request_pending'
  if (code === 4900 || code === 4901) return 'disconnected'
  if (/ProviderNotFound/i.test(name ?? '')) return 'provider_missing'
  if (/timeout/i.test(`${name} ${message}`)) return 'timeout'
  return cause ? connectionErrorCategory(cause, depth + 1) : 'unknown'
}

export function emitWalletAnalytics(
  track: TWalletAnalytics | undefined,
  event: string,
  props: TWalletAnalyticsProperties
): void {
  try {
    track?.(event, props)
  } catch {
    /* Analytics must never interrupt wallet operations. */
  }
}

export async function getWalletAnalyticsProperties(
  connector?: TWalletAnalyticsConnector
): Promise<TWalletAnalyticsProperties> {
  const base = {
    wallet_name: normalizeWalletName(connector?.name),
    wallet_name_source: connector ? 'connector' : 'unknown',
    connection_method: connectionMethod(connector)
  }
  if (base.connection_method !== 'walletconnect' || !connector?.getProvider) return base
  // Read the public WalletConnect session only after connection. Do not block UI or wait indefinitely for metadata.
  const timeout: { id?: ReturnType<typeof setTimeout> } = {}
  try {
    const provider = (await Promise.race([
      connector.getProvider(),
      new Promise<undefined>((resolve) => {
        timeout.id = setTimeout(() => resolve(undefined), 500)
      })
    ])) as { session?: { peer?: { metadata?: { name?: string } } } } | undefined
    const name = provider?.session?.peer?.metadata?.name
    return typeof name === 'string'
      ? { ...base, wallet_name: normalizeWalletName(name), wallet_name_source: 'session_metadata' }
      : base
  } catch {
    return base
  } finally {
    clearTimeout(timeout.id)
  }
}

type TWalletAttempt = {
  path: TWalletPath
  connector?: TWalletAnalyticsConnector
  started: number
  number: number
  finished: boolean
  visibleNames: Set<string>
}
type TWalletJourney = {
  props: TWalletAnalyticsProperties
  started: number
  attempts: number
  failures: number
  more: boolean
  closed: boolean
  active?: TWalletAttempt
  lastOutcome: string
}

export function createWalletAnalytics(track: TWalletAnalytics) {
  const state: { journey?: TWalletJourney } = {}
  const emit = (event: string, props: TWalletAnalyticsProperties) => emitWalletAnalytics(track, event, props)
  const finish = (
    attempt: TWalletAttempt | undefined,
    outcome: string,
    connector = attempt?.connector,
    chainId?: number,
    errorCategory = 'none'
  ) => {
    const journey = state.journey
    if (!journey || !attempt || journey.active !== attempt || attempt.finished) return
    attempt.finished = true
    journey.active = undefined
    journey.lastOutcome = outcome
    if (outcome === 'error' || outcome === 'rejected') journey.failures += 1
    const props = {
      ...journey.props,
      path: attempt.path,
      attempt_number: attempt.number,
      attempt_scope: attempt.path === 'detected' ? 'connector_request' : 'secondary_screen',
      used_more_wallets: journey.more,
      outcome,
      error_category: errorCategory,
      duration_bucket: durationBucket(attempt.started),
      had_previous_failure: journey.failures > (outcome === 'error' || outcome === 'rejected' ? 1 : 0)
    }
    if (outcome !== 'success') {
      emit('wallet_connect_result', {
        ...props,
        wallet_name: normalizeWalletName(connector?.name),
        connection_method: connectionMethod(connector)
      })
      return
    }
    journey.closed = true
    const journeyDuration = durationBucket(journey.started)
    void getWalletAnalyticsProperties(connector).then((wallet) =>
      emit('connect_wallet', {
        ...props,
        ...wallet,
        connector: connector?.name ?? '',
        chainID: String(chainId ?? 0),
        initially_visible:
          wallet.wallet_name === 'unknown' ? 'unknown' : attempt.visibleNames.has(String(wallet.wallet_name)),
        journey_duration_bucket: journeyDuration
      })
    )
  }
  return {
    open(props: TWalletAnalyticsProperties) {
      const previous = state.journey
      if (previous?.active) finish(previous.active, 'superseded')
      state.journey = {
        props,
        started: performance.now(),
        attempts: 0,
        failures: 0,
        more: false,
        closed: false,
        lastOutcome: 'no_selection'
      }
      emit('wallet_picker_open', props)
    },
    start(
      path: TWalletPath,
      connector: TWalletAnalyticsConnector | undefined,
      visible: readonly TWalletAnalyticsConnector[]
    ) {
      const journey = state.journey
      if (!journey || journey.closed) return undefined
      finish(journey.active, 'superseded')
      journey.attempts += 1
      journey.more ||= path === 'more_wallets'
      const attempt: TWalletAttempt = {
        path,
        connector,
        started: performance.now(),
        number: journey.attempts,
        finished: false,
        visibleNames: new Set(visible.map(({ name }) => normalizeWalletName(name)))
      }
      journey.active = attempt
      emit('wallet_connect_started', {
        ...journey.props,
        path,
        first_choice: journey.attempts === 1,
        attempt_number: attempt.number,
        attempt_scope: path === 'detected' ? 'connector_request' : 'secondary_screen',
        had_previous_failure: journey.failures > 0,
        used_more_wallets: journey.more,
        wallet_name: normalizeWalletName(connector?.name),
        connection_method: connectionMethod(connector)
      })
      return attempt
    },
    finish,
    active: () => state.journey?.active,
    close() {
      const journey = state.journey
      if (!journey || journey.closed) return
      finish(journey.active, 'closed_without_connection')
      journey.closed = true
      emit('wallet_picker_closed', {
        ...journey.props,
        outcome: journey.lastOutcome,
        attempts: journey.attempts,
        used_more_wallets: journey.more,
        duration_bucket: durationBucket(journey.started)
      })
    }
  }
}
