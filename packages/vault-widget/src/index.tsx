'use client'

import { Widget, WidgetTabs } from '@yearn/vault-widget/internal/components/widget'
import { useVaultUserData } from '@yearn/vault-widget/internal/hooks/useVaultUserData'
import {
  useVaultWidgetRuntime,
  type VaultWidgetRuntimeOverrides,
  VaultWidgetRuntimeProvider
} from '@yearn/vault-widget/runtime'
import type { VaultWidgetVault } from '@yearn/vault-widget/types'
import { WidgetActionType } from '@yearn/vault-widget/types'
import { BOLD_ADDRESS, YBOLD_CHAIN_ID, YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@yearn/vault-widget/ybold'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useAccount } from 'wagmi'

export type { VaultWidgetRuntime, VaultWidgetRuntimeOverrides } from '@yearn/vault-widget/runtime'
export { useVaultWidgetRuntime, VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
export type {
  NormalizedBalance,
  Token,
  TWidgetRef,
  VaultUserData,
  VaultWidgetAsset,
  VaultWidgetMigration,
  VaultWidgetPrefill,
  VaultWidgetProps,
  VaultWidgetRef,
  VaultWidgetStaking,
  VaultWidgetVault,
  VaultWidgetWithdrawalSource,
  WidgetAddress
} from '@yearn/vault-widget/types'
export { Widget, Widget as VaultWidget, WidgetActionType, WidgetTabs }

export type YBoldVaultWidgetProps = {
  apy?: number
  className?: string
  onSuccess?: () => void
}

function createYBoldVault(apy: number): VaultWidgetVault {
  return {
    address: YBOLD_VAULT_ADDRESS,
    chainId: YBOLD_CHAIN_ID,
    version: '3.0.4',
    decimals: 18,
    symbol: 'yBOLD',
    name: 'yBOLD',
    asset: {
      address: BOLD_ADDRESS,
      decimals: 18,
      symbol: 'BOLD',
      name: 'BOLD Stablecoin'
    },
    forwardAPR: apy,
    staking: {
      address: YBOLD_STAKING_ADDRESS,
      source: 'yBOLD'
    },
    migration: { available: false },
    isRetired: false
  }
}

export function YBoldVaultWidget({ apy = 0, className, onSuccess }: YBoldVaultWidgetProps): ReactElement {
  const { address: account } = useAccount()
  const hostRuntime = useVaultWidgetRuntime()
  const currentVault = useMemo(() => createYBoldVault(apy), [apy])
  const vaultUserData = useVaultUserData({
    vaultAddress: YBOLD_VAULT_ADDRESS,
    assetAddress: BOLD_ADDRESS,
    stakingAddress: YBOLD_STAKING_ADDRESS,
    stakingSource: 'yBOLD',
    chainId: YBOLD_CHAIN_ID,
    account
  })
  const runtime = useMemo<VaultWidgetRuntimeOverrides>(
    () => ({
      wallet: {
        ...hostRuntime.wallet,
        address: account,
        connected: Boolean(account)
      }
    }),
    [account, hostRuntime.wallet]
  )
  const classes = ['yv-widget ybold-widget w-full max-w-md', className].filter(Boolean).join(' ')

  return (
    <VaultWidgetRuntimeProvider value={runtime}>
      <div className={classes}>
        <Widget
          currentVault={currentVault}
          actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
          chainId={YBOLD_CHAIN_ID}
          vaultUserData={vaultUserData}
          handleSuccess={onSuccess}
          forceDepositStake
          disableTokenSelector
          withdrawalSource="staking"
        />
      </div>
    </VaultWidgetRuntimeProvider>
  )
}
