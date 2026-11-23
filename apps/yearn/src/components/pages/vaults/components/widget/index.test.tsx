import { WidgetActionType } from '@pages/vaults/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Widget } from './index'

const VAULT_ADDRESS = '0x1111111111111111111111111111111111111111'
const MIGRATION_TARGET = '0x4444444444444444444444444444444444444444'
const useYearnMock = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/useYearn', () => ({ useYearn: useYearnMock }))

vi.mock('@pages/vaults/components/widget/migrate', () => ({
  WidgetMigrate: ({ migrationTarget }: { migrationTarget: string }) => <div>{`WidgetMigrate:${migrationTarget}`}</div>
}))

vi.mock('@yearn/vault-widget', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@yearn/vault-widget')>()),
  Widget: ({ renderAction }: { renderAction: (action: string) => unknown }) => (
    <div>{renderAction('migrate') as never}</div>
  )
}))

const CURRENT_VAULT = {
  address: VAULT_ADDRESS,
  chainID: 1,
  version: '3.0.4',
  decimals: 18,
  symbol: 'yvUSDC',
  name: 'USDC Vault',
  token: { address: '0x2222222222222222222222222222222222222222', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
  apr: { forwardAPR: { netAPR: 0 } },
  staking: { address: null, available: false, source: '' },
  migration: {
    available: true,
    address: MIGRATION_TARGET,
    contract: '0x5555555555555555555555555555555555555555'
  },
  info: { isRetired: true, isHidden: false }
} as never

function renderMigrate(): string {
  return renderToStaticMarkup(
    <Widget
      currentVault={CURRENT_VAULT}
      actions={[WidgetActionType.Migrate, WidgetActionType.Withdraw]}
      chainId={1}
      vaultUserData={{} as never}
    />
  )
}

describe('Widget migrate gate', () => {
  beforeEach(() => {
    useYearnMock.mockReset()
  })

  it('renders WidgetMigrate when the target is a listed catalog vault on the same chain', () => {
    useYearnMock.mockReturnValue({ vaults: { [MIGRATION_TARGET]: { chainId: 1, address: MIGRATION_TARGET } } })

    expect(renderMigrate()).toContain(`WidgetMigrate:${MIGRATION_TARGET}`)
  })

  it.each([
    ['missing from the catalog', {}],
    ['listed on another chain', { [MIGRATION_TARGET]: { chainId: 10, address: MIGRATION_TARGET } }]
  ])('shows migration as unavailable when the target is %s', (_case, vaults) => {
    useYearnMock.mockReturnValue({ vaults })

    const markup = renderMigrate()

    expect(markup).toContain('Migration is unavailable')
    expect(markup).not.toContain('WidgetMigrate')
  })
})
