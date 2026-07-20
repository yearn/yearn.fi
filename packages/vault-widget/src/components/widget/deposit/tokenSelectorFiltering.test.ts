import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@yearn/vault-widget/internal/utils/yvUsd'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { getStructurallyExcludedDepositTokenAddresses } from './tokenSelectorFiltering'

const DESTINATION_VAULT = '0x0000000000000000000000000000000000000001' as Address
const CANDIDATE_VAULT = '0x0000000000000000000000000000000000000002' as Address
const IRRELEVANT_VAULT = '0x0000000000000000000000000000000000000003' as Address
const OTHER_ASSET = '0x0000000000000000000000000000000000000004' as Address
const HIDDEN_STAKING = '0x0000000000000000000000000000000000000005' as Address

describe('getStructurallyExcludedDepositTokenAddresses', () => {
  it('excludes vault share tokens whose underlying asset is the destination vault', () => {
    const excluded = getStructurallyExcludedDepositTokenAddresses({
      allVaults: [
        {
          chainId: 1,
          address: CANDIDATE_VAULT,
          assetAddress: DESTINATION_VAULT
        },
        {
          chainId: 1,
          address: IRRELEVANT_VAULT,
          assetAddress: OTHER_ASSET
        }
      ],
      destinationVaultAddress: DESTINATION_VAULT
    })

    expect(excluded).toContain(CANDIDATE_VAULT)
    expect(excluded).not.toContain(IRRELEVANT_VAULT)
  })

  it('excludes locked yvUSD for deposits even when the destination vault is unrelated', () => {
    const excluded = getStructurallyExcludedDepositTokenAddresses({
      allVaults: [],
      destinationVaultAddress: OTHER_ASSET
    })

    expect(excluded).toContain(YVUSD_LOCKED_ADDRESS)
  })

  it('excludes hidden vault share and staking tokens from deposit selectors', () => {
    const excluded = getStructurallyExcludedDepositTokenAddresses({
      allVaults: [
        {
          chainId: 1,
          address: IRRELEVANT_VAULT,
          assetAddress: OTHER_ASSET,
          stakingAddress: HIDDEN_STAKING,
          hidden: true
        }
      ],
      destinationVaultAddress: DESTINATION_VAULT
    })

    expect(excluded).toContain(IRRELEVANT_VAULT)
    expect(excluded).toContain(HIDDEN_STAKING)
  })

  it('does not exclude unlocked yvUSD for locked yvUSD deposits', () => {
    const excluded = getStructurallyExcludedDepositTokenAddresses({
      allVaults: [],
      destinationVaultAddress: YVUSD_LOCKED_ADDRESS
    })

    expect(excluded).not.toContain(YVUSD_UNLOCKED_ADDRESS)
  })
})
