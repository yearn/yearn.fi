import {
  applyPackagedVaultDisplay,
  resolvePackagedVaultAnalyticsEvent,
  resolvePackagedVaultMode
} from '@pages/vaults/components/widget/PackagedVaultWidget'
import { WidgetActionType } from '@pages/vaults/types'
import type { VaultWidgetConfig, VaultWidgetEvent, VaultWidgetTransactionMode } from '@yearn/vault-widget'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'

const vaultAddress = '0x0000000000000000000000000000000000000010' as Address

function successEvent(mode: VaultWidgetTransactionMode): VaultWidgetEvent {
  return {
    type: 'transaction_succeeded',
    plan: {
      id: `${mode}-plan`,
      mode,
      quote: {
        adapterId: mode === 'rewards' ? 'merkle-rewards' : 'erc4626',
        amountIn: 123n,
        expectedOut: 456n,
        minExpectedOut: 450n,
        positionAmount: 456n,
        transaction: {
          chainId: 1,
          data: '0x',
          to: vaultAddress
        }
      },
      steps: [],
      walletType: 'eoa'
    }
  }
}

describe('resolvePackagedVaultMode', () => {
  it('maps yearn.fi action and overlay state into package modes', () => {
    expect(resolvePackagedVaultMode(WidgetActionType.Deposit, false, false)).toBe('deposit')
    expect(resolvePackagedVaultMode(WidgetActionType.Withdraw, false, false)).toBe('withdraw')
    expect(resolvePackagedVaultMode(WidgetActionType.Migrate, false, false)).toBe('migrate')
    expect(resolvePackagedVaultMode(WidgetActionType.Deposit, true, false)).toBe('info')
    expect(resolvePackagedVaultMode(WidgetActionType.Deposit, false, true)).toBe('rewards')
  })
})

describe('applyPackagedVaultDisplay', () => {
  it('uses yearn.fi display metrics without replacing package-owned configuration', () => {
    const token = { address: vaultAddress, chainId: 1, decimals: 18, symbol: 'yvTEST' } as const
    const config: VaultWidgetConfig = {
      adapters: [],
      chainId: 1,
      depositTokens: [token],
      display: { assetPriceUsd: 1, estimatedApr: 0.01, positionLabel: 'Vault shares' },
      id: 'test',
      name: 'Test vault',
      positionToken: token,
      vaultAddress,
      withdrawTokens: [token]
    }

    expect(applyPackagedVaultDisplay(config, { assetPriceUsd: 2, estimatedApr: 0.2 })).toMatchObject({
      adapters: config.adapters,
      display: {
        assetPriceUsd: 2,
        estimatedApr: 0.2,
        positionLabel: 'Vault shares'
      }
    })
  })
})

describe('resolvePackagedVaultAnalyticsEvent', () => {
  it.each([
    ['deposit', 'deposit'],
    ['withdraw', 'withdraw'],
    ['migrate', 'migrate'],
    ['rewards', 'claim']
  ] as const)('bridges a successful %s package event to the existing %s event', (mode, name) => {
    expect(resolvePackagedVaultAnalyticsEvent(successEvent(mode), 1, vaultAddress)).toMatchObject({
      name,
      props: {
        action: mode,
        amountInRaw: '123',
        chainID: '1',
        expectedOutRaw: '456',
        vaultAddress
      }
    })
  })

  it('does not report a transaction before it succeeds', () => {
    const started = { ...successEvent('deposit'), type: 'transaction_started' } as VaultWidgetEvent
    expect(resolvePackagedVaultAnalyticsEvent(started, 1, vaultAddress)).toBeUndefined()
  })
})
