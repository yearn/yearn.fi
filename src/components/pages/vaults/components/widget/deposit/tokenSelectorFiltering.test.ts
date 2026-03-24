import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { getStructurallyExcludedDepositTokenAddresses } from './tokenSelectorFiltering'

const DESTINATION_VAULT = '0x0000000000000000000000000000000000000001' as Address
const CANDIDATE_VAULT = '0x0000000000000000000000000000000000000002' as Address
const IRRELEVANT_VAULT = '0x0000000000000000000000000000000000000003' as Address
const OTHER_ASSET = '0x0000000000000000000000000000000000000004' as Address

describe('getStructurallyExcludedDepositTokenAddresses', () => {
  it('excludes vault share tokens whose underlying asset is the destination vault', () => {
    const excluded = getStructurallyExcludedDepositTokenAddresses({
      allVaults: {
        [CANDIDATE_VAULT]: {
          chainID: 1,
          version: '3.0.0',
          address: CANDIDATE_VAULT,
          token: {
            address: DESTINATION_VAULT,
            symbol: 'DEST',
            name: 'Destination Vault',
            description: '',
            decimals: 18
          }
        } as never,
        [IRRELEVANT_VAULT]: {
          chainID: 1,
          version: '3.0.0',
          address: IRRELEVANT_VAULT,
          token: {
            address: OTHER_ASSET,
            symbol: 'OTHER',
            name: 'Other Asset',
            description: '',
            decimals: 18
          }
        } as never
      },
      destinationVaultAddress: DESTINATION_VAULT
    })

    expect(excluded).toContain(CANDIDATE_VAULT)
    expect(excluded).not.toContain(IRRELEVANT_VAULT)
  })

  it('excludes locked yvUSD for unlocked yvUSD deposits even when the vault list is missing it', () => {
    const excluded = getStructurallyExcludedDepositTokenAddresses({
      allVaults: {},
      destinationVaultAddress: YVUSD_UNLOCKED_ADDRESS
    })

    expect(excluded).toContain(YVUSD_LOCKED_ADDRESS)
  })

  it('does not exclude unlocked yvUSD for locked yvUSD deposits', () => {
    const excluded = getStructurallyExcludedDepositTokenAddresses({
      allVaults: {},
      destinationVaultAddress: YVUSD_LOCKED_ADDRESS
    })

    expect(excluded).not.toContain(YVUSD_UNLOCKED_ADDRESS)
  })
})
