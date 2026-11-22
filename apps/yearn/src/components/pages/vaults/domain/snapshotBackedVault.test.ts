import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { describe, expect, it } from 'vitest'
import { buildSnapshotBackedVault } from './snapshotBackedVault'

const ROUTE = { chainId: 1, address: '0x1111111111111111111111111111111111111111' }
const snapshot = (overrides: Partial<TKongVaultSnapshot>): TKongVaultSnapshot =>
  ({
    chainId: 10,
    address: '0x9999999999999999999999999999999999999999',
    name: 'Vault',
    ...overrides
  }) as TKongVaultSnapshot

describe('buildSnapshotBackedVault', () => {
  it('takes chainId and address from the route, not the snapshot body', () => {
    const vault = buildSnapshotBackedVault(snapshot({ origin: 'yearn' }), ROUTE)

    expect(vault.chainId).toBe(1)
    expect(vault.address).toBe(ROUTE.address)
  })

  it('marks the vault as Yearn only for yearn-origin snapshots', () => {
    expect(buildSnapshotBackedVault(snapshot({ origin: 'yearn' }), ROUTE).yearn).toBe(true)
    expect(buildSnapshotBackedVault(snapshot({ origin: null }), ROUTE)).toMatchObject({ yearn: false, origin: null })
    expect(buildSnapshotBackedVault(snapshot({ origin: 'partner' }), ROUTE).yearn).toBe(false)
    expect(buildSnapshotBackedVault(snapshot({ origin: 'yearn', inclusion: { isYearn: false } }), ROUTE).yearn).toBe(
      false
    )
  })
})
