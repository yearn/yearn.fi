'use client'

import { useQuery } from '@tanstack/react-query'
import { useVaultWidgetRuntime } from '@yearn/vault-widget'
import { useAccount } from 'wagmi'
import { ONE_USDC, readProtocolData, TOKEN_DECIMALS } from '@/lib/ethereum'

export const GOVERNANCE_URL = 'https://gov.yearn.fi/t/yip-91-ytranche/14659'
export const GOVERNANCE_VOTE_URL =
  'https://snapshot.box/#/s:styfi.eth/proposal/0xa348d353b66f46c6957a938a42fbf860eaffc855cd9163d8042780f65ea72612'
export const AUDIT_URL = 'https://www.chainsecurity.com/security-audit/yearn-ytranche'

export function addThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatToken(value: bigint, fractionDigits = 2): string {
  const whole = value / ONE_USDC
  const fraction = (value % ONE_USDC).toString().padStart(TOKEN_DECIMALS, '0')
  const visibleFraction = fraction.slice(0, fractionDigits).padEnd(fractionDigits, '0')
  return fractionDigits > 0 ? `${addThousands(whole.toString())}.${visibleFraction}` : addThousands(whole.toString())
}

export function compactToken(value: bigint): string {
  if (value >= 1_000_000_000n * ONE_USDC) {
    return `${formatToken(value / 1_000_000_000n, 2)}b`
  }
  if (value >= 1_000_000n * ONE_USDC) {
    return `${formatToken(value / 1_000_000n, 2)}m`
  }
  if (value >= 10_000n * ONE_USDC) {
    return `${formatToken(value / 1_000n, 1)}k`
  }
  return formatToken(value, 2)
}

export function formatBps(bps: bigint): string {
  return `${bps / 100n}.${(bps % 100n).toString().padStart(2, '0')}`
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function useYTrancheModel() {
  const { address } = useAccount()
  const runtime = useVaultWidgetRuntime()
  const query = useQuery({
    queryKey: ['ytranche-protocol', address],
    queryFn: () => readProtocolData(address),
    refetchInterval: 30_000,
    retry: 1
  })
  const protocol = query.data ?? null
  const juniorAssets = protocol ? protocol.leveredAssets + protocol.equityAssets : 0n
  const totalAssets = (protocol?.trancheAssets ?? 0n) + juniorAssets
  return {
    account: address ?? null,
    connectWallet: runtime.wallet.open,
    protocol,
    protocolError: query.isError,
    targetRateBps: protocol?.targetRateBps ?? 500n,
    depositLimit: protocol?.maxDeposit ?? 0n,
    juniorAssets,
    juniorCushionBps: protocol && totalAssets > 0n ? (juniorAssets * 10_000n) / totalAssets : null,
    coverageBps:
      protocol && protocol.coverageClaim > 0n ? (protocol.coverageCovered * 10_000n) / protocol.coverageClaim : null,
    sharePrice:
      protocol && protocol.trancheSupply > 0n ? (protocol.trancheAssets * ONE_USDC) / protocol.trancheSupply : null
  }
}

export type TYTrancheModel = ReturnType<typeof useYTrancheModel>
