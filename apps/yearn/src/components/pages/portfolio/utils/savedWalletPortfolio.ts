import type { TPortfolioBreakdownResponse } from '@pages/portfolio/types/api'
import { type Address, isAddress, zeroAddress } from 'viem'
import type { TCoveredHoldingsHistory } from '@/types/holdingsHistory'

export function normalizeSavedWallet(value: string): Address | null {
  return isAddress(value, { strict: false }) && value !== zeroAddress ? (value.toLowerCase() as Address) : null
}

export function parseSavedWallets(value: string | null): Address[] {
  try {
    const entries: unknown = JSON.parse(value ?? '[]')
    return Array.isArray(entries)
      ? [
          ...new Set(
            entries.flatMap((entry: unknown) => (typeof entry === 'string' ? (normalizeSavedWallet(entry) ?? []) : []))
          )
        ]
      : []
  } catch {
    return []
  }
}

export type TPortfolioBundle = { id: string; name: string; wallets: Address[] }
type TBundleSnapshot = Pick<TPortfolioBundle, 'name' | 'wallets'>

export function createBundleShareUrl(origin: string, { name, wallets }: TBundleSnapshot): string {
  const url = new URL('/portfolio', origin)
  url.hash = new URLSearchParams({ bundle: JSON.stringify({ version: 1, name, wallets }) }).toString()
  return url.href
}

export function parseBundleShare(value: string): TBundleSnapshot | null {
  try {
    const { version, name, wallets } = JSON.parse(value)
    if (version !== 1 || typeof name !== 'string' || !name.trim() || !Array.isArray(wallets) || !wallets.length) {
      return null
    }
    const addresses = wallets.map((wallet: unknown) =>
      typeof wallet === 'string' ? normalizeSavedWallet(wallet) : null
    )
    if (!addresses.every((address): address is Address => address !== null)) return null
    return { name: name.trim(), wallets: [...new Set(addresses)] }
  } catch {
    return null
  }
}

export function findBundleBySnapshot(bundles: TPortfolioBundle[], { name, wallets }: TBundleSnapshot) {
  const addresses = new Set(wallets)
  return bundles.find(
    (bundle) =>
      bundle.name === name &&
      bundle.wallets.length === addresses.size &&
      bundle.wallets.every((wallet) => addresses.has(wallet))
  )
}

export function parsePortfolioBundles(value: string | null): TPortfolioBundle[] {
  try {
    const entries: unknown = JSON.parse(value ?? '[]')
    if (!Array.isArray(entries)) return []
    const originalWallets = parseSavedWallets(value)
    if (originalWallets.length) return [{ id: 'saved-wallets', name: 'Saved wallets', wallets: originalWallets }]

    return entries.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return []
      const { id, name, wallets } = entry as Partial<TPortfolioBundle>
      if (typeof id !== 'string' || !id || typeof name !== 'string' || !name.trim()) return []
      const addresses = parseSavedWallets(JSON.stringify(wallets))
      return addresses.length ? [{ id, name: name.trim(), wallets: addresses }] : []
    })
  } catch {
    return []
  }
}

type TPositionValue = { address: string; value: number | null }
type TVaultPosition = {
  chainId: number
  vaultAddress: string
  symbol?: string
  shares: bigint
  decimals?: number
  wallets: TPositionValue[]
}

function sumKnownValues(values: Array<number | null>): number | null {
  const known = values.filter((value) => value !== null)
  return known.length ? known.reduce((total, value) => total + value, 0) : null
}

export function combineWalletPositions(snapshots: Array<TPortfolioBreakdownResponse | undefined>, date: string) {
  const forDate = snapshots.filter((snapshot): snapshot is TPortfolioBreakdownResponse => snapshot?.date === date)
  const byVault = new Map<string, TVaultPosition>()
  const fullyValuedWallets = forDate.filter(
    (snapshot) =>
      !snapshot.summary.hasIncompleteShares &&
      snapshot.vaults.every((vault) => vault.status === 'ok' && vault.usdValue !== null)
  ).length
  const knownValues = forDate.map((snapshot) => {
    const values = snapshot.vaults.map((vault) => {
      const vaultAddress = vault.vaultAddress.toLowerCase()
      const key = `${vault.chainId}:${vaultAddress}`
      const position = byVault.get(key) ?? { chainId: vault.chainId, vaultAddress, shares: 0n, wallets: [] }
      const value = vault.status === 'ok' ? vault.usdValue : null
      position.symbol ??= vault.metadata?.symbol
      position.decimals ??= vault.metadata?.decimals
      position.shares += BigInt(vault.shares)
      position.wallets.push({ address: snapshot.address, value })
      byVault.set(key, position)
      return value
    })
    return values.length === 0 && !snapshot.summary.hasIncompleteShares ? 0 : sumKnownValues(values)
  })
  const rows = [...byVault.values()]
    .map((position) => ({ ...position, value: sumKnownValues(position.wallets.map(({ value }) => value)) }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))

  return { rows, value: sumKnownValues(knownValues), fullyValuedWallets }
}

export function combineWalletHistory(histories: Array<TCoveredHoldingsHistory | undefined>, latestDate: string) {
  const days = histories.map((history) => new Map(history?.dataPoints.map((point) => [point.date, point])))
  const dates = [...new Set(days.flatMap((byDate) => [...byDate.keys()]))].filter((date) => date <= latestDate).sort()

  return dates.map((date) => ({
    date,
    value: sumKnownValues(days.map((byDate) => byDate.get(date)?.value ?? null))
  }))
}
