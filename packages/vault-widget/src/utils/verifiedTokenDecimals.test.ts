import { describe, expect, it } from 'vitest'
import {
  getVerifiedTokenDecimals,
  TOKEN_DECIMALS_MISMATCH_MESSAGE,
  TOKEN_DECIMALS_UNAVAILABLE_MESSAGE
} from './verifiedTokenDecimals'

const settledRead = { isNativeToken: false, isLoading: false, isError: false }

describe('getVerifiedTokenDecimals', () => {
  it('returns the decimals when the listed value matches the on-chain value', () => {
    expect(getVerifiedTokenDecimals({ ...settledRead, listedDecimals: 6, onChainDecimals: 6 })).toEqual({
      decimals: 6
    })
    expect(getVerifiedTokenDecimals({ ...settledRead, listedDecimals: 18, onChainDecimals: 18 })).toEqual({
      decimals: 18
    })
  })

  it('blocks when the listed value differs from the on-chain value', () => {
    expect(getVerifiedTokenDecimals({ ...settledRead, listedDecimals: 18, onChainDecimals: 6 })).toEqual({
      error: TOKEN_DECIMALS_MISMATCH_MESSAGE
    })
    expect(getVerifiedTokenDecimals({ ...settledRead, listedDecimals: 6, onChainDecimals: 18 })).toEqual({
      error: TOKEN_DECIMALS_MISMATCH_MESSAGE
    })
  })

  it('blocks when the listed decimals are missing', () => {
    expect(getVerifiedTokenDecimals({ ...settledRead, listedDecimals: undefined, onChainDecimals: 6 })).toEqual({
      error: TOKEN_DECIMALS_UNAVAILABLE_MESSAGE
    })
  })

  it('blocks when the on-chain read is missing or failed', () => {
    expect(getVerifiedTokenDecimals({ ...settledRead, listedDecimals: 6, onChainDecimals: undefined })).toEqual({
      error: TOKEN_DECIMALS_UNAVAILABLE_MESSAGE
    })
    expect(getVerifiedTokenDecimals({ ...settledRead, isError: true, listedDecimals: 6, onChainDecimals: 6 })).toEqual({
      error: TOKEN_DECIMALS_UNAVAILABLE_MESSAGE
    })
  })

  it('returns no decimals and no error while the on-chain read is pending', () => {
    expect(getVerifiedTokenDecimals({ ...settledRead, isLoading: true, listedDecimals: 6 })).toEqual({})
  })

  it('checks native tokens against the native decimals without an on-chain read', () => {
    const native = { ...settledRead, isNativeToken: true, isLoading: false }
    expect(getVerifiedTokenDecimals({ ...native, listedDecimals: 18 })).toEqual({ decimals: 18 })
    expect(getVerifiedTokenDecimals({ ...native, listedDecimals: 6 })).toEqual({
      error: TOKEN_DECIMALS_MISMATCH_MESSAGE
    })
  })
})
