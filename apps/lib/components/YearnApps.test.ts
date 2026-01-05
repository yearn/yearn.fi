import { describe, expect, it } from 'vitest'

import { APP_GROUPS } from './YearnApps'

describe('APP_GROUPS', () => {
  const allNames = APP_GROUPS.flatMap((group) => group.items.map((item) => item.name))

  it('includes newly requested internal tools', () => {
    expect(allNames).toEqual(
      expect.arrayContaining(['YearnX', 'APR Oracle', 'yCMS', 'Token Assets', 'Seafood', 'Kong', 'PowerGlove'])
    )
  })

  it('includes resource links for community navigation', () => {
    expect(allNames).toEqual(expect.arrayContaining(['Docs', 'Support', 'Blog', 'Discourse']))
  })

  it('exposes both v3 and factory vault entrypoints', () => {
    expect(allNames).toEqual(expect.arrayContaining(['V3 Vaults', 'Factory Vaults']))
  })
})
