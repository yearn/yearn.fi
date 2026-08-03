import { shouldEnableVaultListFetch } from '@pages/vaults/hooks/useEnsureVaultListFetch'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { describe, expect, it } from 'vitest'

describe('shouldEnableVaultListFetch', () => {
  it('returns false for direct detail loads until snapshot metadata is available', () => {
    expect(
      shouldEnableVaultListFetch({
        hasTriggeredVaultListFetch: false,
        hasVaultList: false,
        isYvUsd: false,
        snapshotVault: undefined
      })
    ).toBe(false)
  })

  it('returns true once snapshot metadata is available for a direct detail load', () => {
    expect(
      shouldEnableVaultListFetch({
        hasTriggeredVaultListFetch: false,
        hasVaultList: false,
        isYvUsd: false,
        snapshotVault: { address: '0x0000000000000000000000000000000000000001' } as unknown as TKongVaultSnapshot
      })
    ).toBe(true)
  })

  it('returns false after the vault list bootstrap has already been triggered', () => {
    expect(
      shouldEnableVaultListFetch({
        hasTriggeredVaultListFetch: true,
        hasVaultList: false,
        isYvUsd: false,
        snapshotVault: { address: '0x0000000000000000000000000000000000000001' } as unknown as TKongVaultSnapshot
      })
    ).toBe(false)
  })

  it('returns true for yvUSD detail routes even before snapshot metadata arrives', () => {
    expect(
      shouldEnableVaultListFetch({
        hasTriggeredVaultListFetch: false,
        hasVaultList: false,
        isYvUsd: true,
        snapshotVault: undefined
      })
    ).toBe(true)
  })
})
