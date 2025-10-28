import { describe, expect, it } from 'vitest'

import { APP_GROUPS } from './YearnApps'

describe('APP_GROUPS', () => {
  const allNames = APP_GROUPS.flatMap((group) => group.items.map((item) => item.name))

  it('includes newly requested internal tools', () => {
    expect(allNames).toEqual(
      expect.arrayContaining(['Yearn Space', 'Oracle', 'CMS', 'Token Assets', 'Seafood', 'Kong'])
    )
  })

  it('includes resource links for community navigation', () => {
    expect(allNames).toEqual(expect.arrayContaining(['Docs', 'Support', 'Blog', 'Discourse']))
  })

  it('exposes a home tile because the logo no longer navigates directly', () => {
    expect(allNames).toContain('Home')
  })
})
