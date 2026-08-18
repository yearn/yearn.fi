import { getTokenLogoSources } from '@pages/vaults/components/widget/tokenLogo.utils'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultStakingAddress
} from '@pages/vaults/domain/kongVaultSelectors'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { TokenLogoV2 } from '@shared/components/TokenLogoV2'
import { useWalletStatus, useWalletTokens } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenList } from '@shared/contexts/WithTokenList'
import { formatTAmount, toAddress } from '@shared/utils'
import { formatUSD } from '@shared/utils/format'
import { getNetwork } from '@shared/utils/wagmi'
import { type ReactElement, useMemo, useState } from 'react'
import { type Address, zeroAddress } from 'viem'
import { env } from '@/env'
import { MAJOR_SWAP_TOKENS, SWAP_CHAIN_IDS } from './constants'
import { getSwapWalletAssets } from './walletAssets'

type TSwapWalletPanelProps = {
  onSelectToken: (address: Address, chainId: number) => void
}

export function SwapWalletPanel({ onSelectToken }: TSwapWalletPanelProps): ReactElement {
  const { address: account, openLoginModal } = useWeb3()
  const { balances } = useWalletTokens()
  const { isLoading } = useWalletStatus()
  const { allVaults, isLoadingVaultList } = useYearn()
  const { tokenLists } = useTokenList()
  const [search, setSearch] = useState('')
  const [showUnverified, setShowUnverified] = useState(false)

  const vaultAddressesByChain = useMemo(
    () =>
      Object.fromEntries(
        SWAP_CHAIN_IDS.map((chainId) => [
          chainId,
          new Set(
            Object.values(allVaults)
              .filter((vault) => getVaultChainID(vault) === chainId && !getVaultInfo(vault).isHidden)
              .map((vault) => toAddress(getVaultAddress(vault)).toLowerCase())
          )
        ])
      ) as Record<number, Set<string>>,
    [allVaults]
  )
  const hiddenVaultAddressesByChain = useMemo(
    () =>
      Object.fromEntries(
        SWAP_CHAIN_IDS.map((chainId) => {
          const addresses = Object.values(allVaults).flatMap((vault) => {
            if (getVaultChainID(vault) !== chainId || !getVaultInfo(vault).isHidden) {
              return []
            }

            const hiddenAddresses = [toAddress(getVaultAddress(vault)).toLowerCase()]
            const stakingAddress = getVaultStakingAddress(vault)
            if (stakingAddress !== zeroAddress) {
              hiddenAddresses.push(stakingAddress.toLowerCase())
            }
            return hiddenAddresses
          })
          return [chainId, new Set(addresses)]
        })
      ) as Record<number, Set<string>>,
    [allVaults]
  )

  const assetsByChain = useMemo(
    () =>
      Object.fromEntries(
        SWAP_CHAIN_IDS.map((chainId) => {
          const knownAddresses = new Set(
            Object.keys(tokenLists[chainId] || {}).map((address) => toAddress(address).toLowerCase())
          )
          const majorAddresses = new Set(MAJOR_SWAP_TOKENS[chainId].map((address) => address.toLowerCase()))
          const yearnAddresses = vaultAddressesByChain[chainId] ?? new Set<string>()
          const assets = getSwapWalletAssets({
            tokens: Object.values(balances[chainId] || {}),
            knownAddresses,
            majorAddresses,
            yearnAddresses,
            excludedAddresses: hiddenVaultAddressesByChain[chainId] ?? new Set<string>(),
            showUnverified
          }).filter(({ token }) => {
            const query = search.trim().toLowerCase()
            return (
              !query ||
              token.symbol.toLowerCase().includes(query) ||
              token.name.toLowerCase().includes(query) ||
              token.address.toLowerCase().includes(query)
            )
          })

          return [chainId, assets] as const
        })
      ),
    [balances, hiddenVaultAddressesByChain, search, showUnverified, tokenLists, vaultAddressesByChain]
  )

  const unverifiedCount = useMemo(
    () =>
      SWAP_CHAIN_IDS.reduce((count, chainId) => {
        const knownAddresses = new Set(
          Object.keys(tokenLists[chainId] || {}).map((address) => toAddress(address).toLowerCase())
        )
        const majorAddresses = new Set(MAJOR_SWAP_TOKENS[chainId].map((address) => address.toLowerCase()))
        const yearnAddresses = vaultAddressesByChain[chainId] ?? new Set<string>()
        const allAssets = getSwapWalletAssets({
          tokens: Object.values(balances[chainId] || {}),
          knownAddresses,
          majorAddresses,
          yearnAddresses,
          excludedAddresses: hiddenVaultAddressesByChain[chainId] ?? new Set<string>(),
          showUnverified: true
        })
        return count + allAssets.filter((asset) => !asset.isVerified).length
      }, 0),
    [balances, hiddenVaultAddressesByChain, tokenLists, vaultAddressesByChain]
  )

  if (!account) {
    return (
      <div className="flex min-h-[430px] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-text-primary">Connect to view your wallet</h3>
          <p className="text-sm text-text-secondary">Balances from supported networks will appear here.</p>
        </div>
        <button
          type="button"
          onClick={openLoginModal}
          className="yearn--button--nextgen rounded-md bg-text-primary px-5 py-2.5 text-sm text-surface"
        >
          Connect Wallet
        </button>
      </div>
    )
  }

  const visibleAssetCount = Object.values(assetsByChain).reduce((count, assets) => count + assets.length, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-5">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search wallet assets"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-text-secondary"
        />
        <label className="inline-flex min-h-6 cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={showUnverified}
            disabled={unverifiedCount === 0}
            onChange={(event) => setShowUnverified(event.target.checked)}
            className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span>Show unverified assets</span>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading || isLoadingVaultList ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-text-secondary">
            Loading balances...
          </div>
        ) : visibleAssetCount === 0 ? (
          <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-text-secondary">
            {search ? 'No wallet assets match this search.' : 'No verified token balances found.'}
          </div>
        ) : (
          <div className="space-y-4">
            {SWAP_CHAIN_IDS.map((chainId) => {
              const assets = assetsByChain[chainId] || []
              if (assets.length === 0) return null
              const network = getNetwork(chainId)

              return (
                <section key={chainId} className="space-y-1">
                  <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-text-secondary">
                    <ImageWithFallback
                      src={`${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/chains/${chainId}/logo.svg`}
                      alt=""
                      width={16}
                      height={16}
                      className="rounded-full"
                    />
                    <span>{network.name}</span>
                  </div>
                  {assets.map(({ token, isYearn, isVerified }) => {
                    const logo = getTokenLogoSources({
                      address: token.address,
                      chainId,
                      logoURI: token.logoURI,
                      size: 32
                    })
                    return (
                      <button
                        key={`${chainId}-${token.address}`}
                        type="button"
                        onClick={() => onSelectToken(toAddress(token.address), chainId)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-secondary"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <TokenLogoV2
                            src={logo.src}
                            altSrc={logo.altSrc}
                            tokenSymbol={token.symbol}
                            tokenName={token.name}
                            chainId={chainId}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-text-primary">{token.symbol}</span>
                              {isYearn ? (
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  Yearn Vault
                                </span>
                              ) : !isVerified ? (
                                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                                  Unverified
                                </span>
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-text-secondary">{token.name}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium text-text-primary">
                            {formatTAmount({ value: token.balance.raw, decimals: token.decimals })}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {token.value > 0 ? formatUSD(token.value) : 'Unavailable'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
