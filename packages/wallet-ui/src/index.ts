export {
  createWalletAppKitOptions,
  isSafeConnectorId,
  requireWalletConnectProjectId,
  type TCreateWalletAppKitOptions,
  WALLET_APPKIT_FEATURES,
  WALLETCONNECT_WALLET_IDS,
  WALLETCONNECT_WALLETS
} from '@yearn/wallet-ui/appkit'
export {
  connectEvmWalletWithAppKit,
  formatWalletAddress,
  getBrowserWalletLabel,
  getWalletConnectionErrorMessage,
  resolveEvmAppKitWalletItem,
  selectBrowserWalletConnectors,
  type TEvmAppKitConnectionClient,
  type TSelectBrowserWalletConnectorOptions,
  type TWalletConnectorSummary
} from '@yearn/wallet-ui/connectors'
export {
  DEFAULT_WALLET_DRAWER_ID,
  type TWalletDrawerContext,
  useWalletDrawer
} from '@yearn/wallet-ui/context'
export { ReownWalletModalOverrides } from '@yearn/wallet-ui/ReownWalletModalOverrides'
export {
  type TWalletDrawerProviderProps,
  WalletDrawerProvider
} from '@yearn/wallet-ui/WalletDrawer'
