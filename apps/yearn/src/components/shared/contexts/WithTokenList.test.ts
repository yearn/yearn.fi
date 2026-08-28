import { describe, expect, it } from 'vitest'
import { getUnloadedTokenListURIs } from './WithTokenList'

describe('getUnloadedTokenListURIs', () => {
  it('returns only token list URLs that have not loaded yet', () => {
    expect(
      getUnloadedTokenListURIs({
        hashList: 'https://example.com/yearn.json,https://example.com/popular.json',
        loadedURIs: new Set(['https://example.com/yearn.json'])
      })
    ).toEqual(['https://example.com/popular.json'])
  })

  it('returns an empty list when all token list URLs are already loaded', () => {
    expect(
      getUnloadedTokenListURIs({
        hashList: 'https://example.com/yearn.json,https://example.com/popular.json',
        loadedURIs: new Set(['https://example.com/yearn.json', 'https://example.com/popular.json'])
      })
    ).toEqual([])
  })
})
