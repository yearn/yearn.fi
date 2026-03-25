import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { getStakePreviewCall, getStakingConvertToAssetsCall } from '@pages/vaults/hooks/actions/stakingAdapter'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { createPublicClient, formatUnits, http } from 'viem'
import { mainnet } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { calculateDepositValueInfo } from './valuation'

const mainnetRpc = process.env.VITE_RPC_URI_FOR_1
const ONE_ETHER = 10n ** 18n

const fixtures = [
  {
    label: 'yBOLD',
    chain: mainnet,
    vaultAddress: YBOLD_VAULT_ADDRESS,
    stakingAddress: YBOLD_STAKING_ADDRESS,
    stakingSource: 'yBOLD',
    vaultDecimals: 18,
    assetTokenDecimals: 18,
    sampleDepositAssets: 100n * ONE_ETHER
  }
] as const

if (!mainnetRpc) {
  describe('live staking deposit valuation', () => {
    it('skips when VITE_RPC_URI_FOR_1 is unavailable', () => {
      expect(mainnetRpc).toBeFalsy()
    })
  })
} else {
  describe('live staking deposit valuation', () => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(mainnetRpc)
    })

    fixtures.forEach((fixture) => {
      it(`does not flag a false-positive price impact for ${fixture.label}`, async () => {
        const previewCall = getStakePreviewCall(fixture.stakingSource, fixture.sampleDepositAssets)
        expect(previewCall).toBeDefined()

        const previewShares = (await client.readContract({
          address: fixture.stakingAddress,
          abi: previewCall?.abi as any,
          functionName: previewCall?.functionName as any,
          args: previewCall?.args as any
        })) as bigint

        const convertCall = getStakingConvertToAssetsCall(fixture.stakingSource, previewShares)
        expect(convertCall).toBeDefined()

        const normalizedVaultShares = (await client.readContract({
          address: fixture.stakingAddress,
          abi: convertCall?.abi as any,
          functionName: convertCall?.functionName as any,
          args: convertCall?.args as any
        })) as bigint

        const pricePerShare = (await client.readContract({
          address: fixture.vaultAddress,
          abi: erc4626Abi,
          functionName: 'pricePerShare'
        })) as bigint

        const inputTokenUsdPrice = Number(formatUnits(pricePerShare, fixture.vaultDecimals))

        const legacyInfo = calculateDepositValueInfo({
          depositAmountBn: fixture.sampleDepositAssets,
          inputTokenDecimals: fixture.vaultDecimals,
          inputTokenUsdPrice,
          normalizedVaultShares: previewShares,
          vaultDecimals: fixture.vaultDecimals,
          pricePerShare,
          assetTokenDecimals: fixture.assetTokenDecimals,
          assetUsdPrice: 1
        })

        const normalizedInfo = calculateDepositValueInfo({
          depositAmountBn: fixture.sampleDepositAssets,
          inputTokenDecimals: fixture.vaultDecimals,
          inputTokenUsdPrice,
          normalizedVaultShares,
          vaultDecimals: fixture.vaultDecimals,
          pricePerShare,
          assetTokenDecimals: fixture.assetTokenDecimals,
          assetUsdPrice: 1
        })

        expect(previewShares).toBeGreaterThan(0n)
        expect(normalizedVaultShares).toBeGreaterThan(0n)
        expect(legacyInfo.isHighPriceImpact).toBe(true)
        expect(normalizedInfo.isHighPriceImpact).toBe(false)
        expect(normalizedInfo.priceImpactPercentage).toBeLessThan(5)
      })
    })
  })
}
