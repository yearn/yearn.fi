import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YvUsdDeposit } from './YvUsdDeposit'

const USDC_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const UNLOCKED_VAULT_ADDRESS = '0x0000000000000000000000000000000000000010' as const
const LOCKED_VAULT_ADDRESS = '0x0000000000000000000000000000000000000020' as const
const YVUSD_TOKEN_ADDRESS = '0x696d02Db93291651ED510704c9b286841d506987' as const

const { mockUseYvUsdVaults, mockUseVaultUserData, mockWidgetDeposit } = vi.hoisted(() => ({
  mockUseYvUsdVaults: vi.fn(),
  mockUseVaultUserData: vi.fn(),
  mockWidgetDeposit: vi.fn()
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x0000000000000000000000000000000000000003'
  })
}))

vi.mock('@pages/vaults/hooks/useYvUsdVaults', () => ({
  useYvUsdVaults: mockUseYvUsdVaults
}))

vi.mock('@pages/vaults/hooks/useVaultUserData', () => ({
  useVaultUserData: mockUseVaultUserData
}))

vi.mock('../deposit', () => ({
  WidgetDeposit: (props: unknown) => {
    mockWidgetDeposit(props)
    return <div>{'WidgetDeposit'}</div>
  }
}))

describe('YvUsdDeposit', () => {
  beforeEach(() => {
    mockWidgetDeposit.mockReset()
    mockUseYvUsdVaults.mockReturnValue({
      isLoading: false,
      metrics: {
        unlocked: { apy: 0.05 },
        locked: { apy: 0.08 }
      },
      unlockedVault: {
        address: UNLOCKED_VAULT_ADDRESS,
        decimals: 18,
        token: {
          address: USDC_ADDRESS,
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6
        },
        apr: { netAPR: 0.05 }
      },
      lockedVault: {
        address: LOCKED_VAULT_ADDRESS,
        decimals: 18,
        token: {
          address: YVUSD_TOKEN_ADDRESS,
          name: 'yvUSD',
          symbol: 'yvUSD',
          decimals: 18
        },
        apr: { netAPR: 0.08 }
      }
    })
  })

  it('refetches both yvUSD user-data branches after deposit success', () => {
    const unlockedRefetch = vi.fn()
    const lockedRefetch = vi.fn()
    mockUseVaultUserData
      .mockReturnValueOnce({
        assetToken: {
          address: USDC_ADDRESS,
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          chainID: 1,
          balance: { raw: 5n, normalized: 5, display: '5', decimals: 6 }
        },
        vaultToken: {
          address: YVUSD_TOKEN_ADDRESS,
          name: 'yvUSD',
          symbol: 'yvUSD',
          decimals: 18,
          chainID: 1,
          balance: { raw: 0n, normalized: 0, display: '0', decimals: 18 }
        },
        pricePerShare: 1_000_000n,
        availableToDeposit: 0n,
        depositedShares: 0n,
        depositedValue: 0n,
        stakingWithdrawableAssets: 0n,
        stakingRedeemableShares: 0n,
        isLoading: false,
        refetch: unlockedRefetch
      })
      .mockReturnValueOnce({
        assetToken: {
          address: YVUSD_TOKEN_ADDRESS,
          name: 'yvUSD',
          symbol: 'yvUSD',
          decimals: 18,
          chainID: 1,
          balance: { raw: 2n, normalized: 2, display: '2', decimals: 18 }
        },
        vaultToken: {
          address: LOCKED_VAULT_ADDRESS,
          name: 'Locked yvUSD',
          symbol: 'Locked yvUSD',
          decimals: 18,
          chainID: 1,
          balance: { raw: 0n, normalized: 0, display: '0', decimals: 18 }
        },
        pricePerShare: 1_000_000_000_000_000_000n,
        availableToDeposit: 0n,
        depositedShares: 0n,
        depositedValue: 0n,
        stakingWithdrawableAssets: 0n,
        stakingRedeemableShares: 0n,
        isLoading: false,
        refetch: lockedRefetch
      })

    const onDepositSuccess = vi.fn()
    renderToStaticMarkup(<YvUsdDeposit chainId={1} assetAddress={USDC_ADDRESS} onDepositSuccess={onDepositSuccess} />)

    const props = mockWidgetDeposit.mock.calls.at(-1)?.[0] as { handleDepositSuccess?: () => void }
    props.handleDepositSuccess?.()

    expect(unlockedRefetch).toHaveBeenCalledTimes(1)
    expect(lockedRefetch).toHaveBeenCalledTimes(1)
    expect(onDepositSuccess).toHaveBeenCalledTimes(1)
  })
})
