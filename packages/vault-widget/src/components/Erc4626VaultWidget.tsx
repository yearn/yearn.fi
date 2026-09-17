'use client'

import { useErc4626Vault } from '@yearn/vault-widget/erc4626/useErc4626Vault'
import { Widget } from '@yearn/vault-widget/internal/components/widget'
import { useVaultWidgetRuntime, VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { WidgetActionType, type WidgetAddress } from '@yearn/vault-widget/types'
import { formatUnits } from 'viem'

export type Erc4626VaultWidgetProps = { address: WidgetAddress; chainId: number; className?: string }

function Erc4626VaultContent({ address, chainId, className }: Erc4626VaultWidgetProps) {
  const runtime = useVaultWidgetRuntime()
  const { vault, vaultUserData, isLoading, error, refetch } = useErc4626Vault({
    address,
    chainId,
    account: runtime.wallet.address
  })
  const retry = () => {
    void refetch().catch(() => undefined)
  }
  if (!vault || !vaultUserData)
    return (
      <div className="rounded-lg border border-border bg-surface p-6" role="status">
        {isLoading ? 'Reading vault…' : error}
        {!isLoading && (
          <button type="button" onClick={retry} className="ml-3 underline">
            Retry
          </button>
        )}
      </div>
    )
  const explorer = runtime.chains.getChain(chainId)?.blockExplorerUrl
  return (
    <div className={['yv-widget space-y-4', className].filter(Boolean).join(' ')}>
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="mb-2 text-xs text-text-secondary">{runtime.chains.getChain(chainId)?.name}</p>
        <h2 className="text-xl font-semibold">{vault.name}</h2>
        <p className="mt-1 text-sm text-text-secondary">Deposit and withdraw {vault.asset.symbol}</p>
        {explorer && (
          <a
            href={`${explorer}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all font-mono text-xs underline"
          >
            {address}
          </a>
        )}
        {runtime.wallet.address && (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Position value</dt>
              <dd className="break-all text-right">
                {formatUnits(vaultUserData.depositedValue, vault.asset.decimals)} {vault.asset.symbol}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Available to withdraw</dt>
              <dd className="break-all text-right">
                {formatUnits(vaultUserData.erc4626?.maxWithdraw ?? 0n, vault.asset.decimals)} {vault.asset.symbol}
              </dd>
            </div>
          </dl>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}{' '}
          <button type="button" onClick={retry} className="underline">
            Retry
          </button>
        </p>
      )}
      <Widget
        currentVault={vault}
        chainId={chainId}
        vaultUserData={vaultUserData}
        actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
        disableTokenSelector
        disableDepositStaking
        withdrawalSource="vault"
      />
      <p className="text-xs text-text-secondary">
        Amounts are in {vault.asset.symbol}. Estimates can change before confirmation; withdrawal fees and vault limits
        may apply.
      </p>
    </div>
  )
}

/** A direct-only preset. The host supplies wallet UI, configured chains and notifications. */
export function Erc4626VaultWidget(props: Erc4626VaultWidgetProps) {
  const runtime = useVaultWidgetRuntime()
  return (
    <VaultWidgetRuntimeProvider value={{ routing: { isEnsoEnabled: () => false }, settings: { autoStake: false } }}>
      <Erc4626VaultContent
        key={`${props.chainId}:${props.address.toLowerCase()}:${runtime.wallet.address?.toLowerCase() ?? 'disconnected'}`}
        {...props}
      />
    </VaultWidgetRuntimeProvider>
  )
}
