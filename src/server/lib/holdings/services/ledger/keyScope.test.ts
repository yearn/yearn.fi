import { describe, expect, it } from 'vitest'
import { assertLedgerKeysShareWalletScope } from '@/server/lib/holdings/services/ledger/keyScope'

describe('ledger Redis key scope', () => {
  it('accepts keys with the same hashed-wallet tag', () => {
    const walletHash = 'a'.repeat(64)
    expect(
      assertLedgerKeysShareWalletScope([
        `holdings:ledger:v1:{${walletHash}}:lock`,
        `holdings:ledger:v1:{${walletHash}}:head`
      ])
    ).toBe(walletHash)
  })

  it('accepts keys in the same optional key namespace', () => {
    const walletHash = 'a'.repeat(64)
    expect(
      assertLedgerKeysShareWalletScope([
        `holdings:ledger:v1:{${walletHash}}:namespace:benchmark_01:lock`,
        `holdings:ledger:v1:{${walletHash}}:namespace:benchmark_01:head`
      ])
    ).toBe(walletHash)
  })

  it('rejects unscoped and cross-wallet key sets', () => {
    const firstWallet = 'a'.repeat(64)
    const secondWallet = 'b'.repeat(64)

    expect(() => assertLedgerKeysShareWalletScope(['ledger:lock'])).toThrow(
      'Ledger Redis keys must use the versioned hashed-wallet namespace'
    )
    expect(() =>
      assertLedgerKeysShareWalletScope([
        `holdings:ledger:v1:{${firstWallet}}:lock`,
        `holdings:ledger:v1:{${secondWallet}}:head`
      ])
    ).toThrow('Ledger Redis keys must belong to the same hashed wallet')
  })

  it('rejects mixed, mismatched, and malformed key namespaces', () => {
    const walletHash = 'a'.repeat(64)

    expect(() =>
      assertLedgerKeysShareWalletScope([
        `holdings:ledger:v1:{${walletHash}}:lock`,
        `holdings:ledger:v1:{${walletHash}}:namespace:benchmark_01:head`
      ])
    ).toThrow('Ledger Redis keys must belong to the same hashed wallet')
    expect(() =>
      assertLedgerKeysShareWalletScope([
        `holdings:ledger:v1:{${walletHash}}:namespace:benchmark_01:lock`,
        `holdings:ledger:v1:{${walletHash}}:namespace:benchmark_02:head`
      ])
    ).toThrow('Ledger Redis keys must belong to the same hashed wallet')
    expect(() =>
      assertLedgerKeysShareWalletScope([`holdings:ledger:v1:{${walletHash}}:namespace:unsafe.value:head`])
    ).toThrow('Ledger Redis keys must use the versioned hashed-wallet namespace')
    expect(() => assertLedgerKeysShareWalletScope([`holdings:ledger:v1:{${walletHash}}:namespace::head`])).toThrow(
      'Ledger Redis keys must use the versioned hashed-wallet namespace'
    )
  })
})
