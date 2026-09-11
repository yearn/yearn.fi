export type TYearnWalletRuntime = 'app' | 'ledger-iframe' | 'safe-iframe'

type TYearnWalletEnvironment = {
  ancestorOrigin?: string
  hasLedgerLiveProvider?: boolean
  isIframe: boolean
}

const SAFE_APP_ORIGIN = 'https://app.safe.global'

function readYearnWalletEnvironment(): TYearnWalletEnvironment {
  if (typeof window === 'undefined') {
    return { isIframe: false }
  }

  const ancestorOrigin = window.location.ancestorOrigins?.[0]?.toString()
  const ethereum = (window as Window & { ethereum?: unknown }).ethereum

  return {
    ancestorOrigin,
    hasLedgerLiveProvider: isLedgerLiveProvider(ethereum),
    isIframe: window.self !== window.top || Boolean(window.location.ancestorOrigins?.length)
  }
}

export function isLedgerLiveProvider(provider: unknown): boolean {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'isLedgerLive' in provider &&
    (provider as { isLedgerLive?: unknown }).isLedgerLive === true
  )
}

export function isSafeAppOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return false
  }

  try {
    return new URL(origin).origin.toLowerCase() === SAFE_APP_ORIGIN
  } catch {
    return false
  }
}

export function resolveYearnWalletRuntime(
  environment: TYearnWalletEnvironment = readYearnWalletEnvironment()
): TYearnWalletRuntime {
  if (environment.isIframe && isSafeAppOrigin(environment.ancestorOrigin)) {
    return 'safe-iframe'
  }

  if (environment.hasLedgerLiveProvider) {
    return 'ledger-iframe'
  }

  if (!environment.isIframe) {
    return 'app'
  }

  return 'ledger-iframe'
}

export function getYearnWagmiStorageKey(runtime: TYearnWalletRuntime): string {
  return runtime === 'app' ? 'wagmi' : `yearn-${runtime}`
}
