import {
  normalizeTokenForWidget,
  normalizeVaultUserDataForWidget
} from '@pages/vaults/components/widget/vaultWidgetAdapter'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import type { TToken } from '@shared/types'
import {
  WidgetDeposit as SharedWidgetDeposit,
  WidgetWithdraw as SharedWidgetWithdraw
} from '@yearn/vault-widget/advanced'
import type { ComponentProps, ReactElement } from 'react'

type YearnWidgetDepositProps = Omit<
  ComponentProps<typeof SharedWidgetDeposit>,
  'vaultUserData' | 'tokenSelectorExtraTokens'
> & {
  vaultUserData: VaultUserData
  tokenSelectorExtraTokens?: TToken[]
}

export function WidgetDeposit({
  chainId,
  vaultUserData,
  tokenSelectorExtraTokens,
  ...props
}: YearnWidgetDepositProps): ReactElement {
  return (
    <SharedWidgetDeposit
      {...props}
      chainId={chainId}
      vaultUserData={normalizeVaultUserDataForWidget(vaultUserData, chainId)}
      tokenSelectorExtraTokens={tokenSelectorExtraTokens?.flatMap((token) => {
        const normalizedToken = normalizeTokenForWidget(token, chainId)
        return normalizedToken ? [normalizedToken] : []
      })}
    />
  )
}

type YearnWidgetWithdrawProps = Omit<ComponentProps<typeof SharedWidgetWithdraw>, 'vaultUserData'> & {
  vaultUserData: VaultUserData
}

export function WidgetWithdraw({ chainId, vaultUserData, ...props }: YearnWidgetWithdrawProps): ReactElement {
  return (
    <SharedWidgetWithdraw
      {...props}
      chainId={chainId}
      vaultUserData={normalizeVaultUserDataForWidget(vaultUserData, chainId)}
    />
  )
}
