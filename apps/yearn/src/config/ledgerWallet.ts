import type { EIP1193Provider } from 'viem'
import { type CreateConnectorFn, createConnector } from 'wagmi'
import { injected, type WalletConnectParameters, walletConnect } from 'wagmi/connectors'
import { isLedgerLiveProvider } from '@/config/walletRuntime'

export const LEDGER_WALLET_ID = 'ledger'
const LEDGER_WALLET_NAME = 'Ledger'
const LEGACY_LEDGER_STORAGE_PREFIX = 'clientTwo'

type TLedgerWalletParameters = {
  metadata: WalletConnectParameters['metadata']
  projectId: string
}

function getLedgerLiveProvider(): EIP1193Provider | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum
  return isLedgerLiveProvider(provider) ? provider : undefined
}

export function ledgerWallet({ metadata, projectId }: TLedgerWalletParameters): CreateConnectorFn {
  const ledgerLiveProvider = getLedgerLiveProvider()
  const connector = ledgerLiveProvider
    ? injected({
        target: {
          id: LEDGER_WALLET_ID,
          name: LEDGER_WALLET_NAME,
          provider: ledgerLiveProvider
        }
      })
    : walletConnect({
        customStoragePrefix: LEGACY_LEDGER_STORAGE_PREFIX,
        metadata,
        projectId,
        showQrModal: false,
        telemetryEnabled: false
      })

  return createConnector((config) => ({
    ...connector(config),
    id: LEDGER_WALLET_ID,
    name: LEDGER_WALLET_NAME
  }))
}
