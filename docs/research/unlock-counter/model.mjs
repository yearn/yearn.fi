// V3 allocator / Tokenized Strategy share-accounting model, fixed snapshot state.
export const SCALE = 1_000_000_000_000n
const min = (a, b) => (a < b ? a : b)
const max = (a, b) => (a > b ? a : b)
export const convertSharesAt = (row, requestedShares, snapshotTimestamp, timestamp) => {
  if (!row.validated) throw new Error('Unsupported or unvalidated share accounting')
  if (row.version?.startsWith('morpho-')) {
    const quote = row.conversions?.[String(requestedShares)]?.[String(timestamp)]
    if (quote === null || quote === undefined)
      throw new Error(
        `Missing authoritative Morpho conversion: ${row.chainId}:${row.address}, shares ${requestedShares}, timestamp ${timestamp}`
      )
    return BigInt(quote)
  }
  if (row.version === 'v2') {
    const supply = BigInt(row.reads.totalSupply)
    const assets = BigInt(row.reads.totalAssets)
    const elapsed = max(0n, max(BigInt(timestamp), BigInt(snapshotTimestamp)) - BigInt(row.reads.lastReport))
    const ratio = elapsed * BigInt(row.reads.lockedProfitDegradation)
    const locked = BigInt(row.reads.lockedProfit)
    const remaining = ratio >= 10n ** 18n ? 0n : locked - (locked * ratio) / 10n ** 18n
    if (supply <= 0n || remaining > assets) throw new Error('Invalid V2 free funds')
    return (BigInt(requestedShares) * (assets - remaining)) / supply
  }
  const supply = BigInt(row.reads.totalSupply)
  const assets = BigInt(row.reads.totalAssets)
  const shares = BigInt(row.holderShares)
  const locked = BigInt(row.lockedRemaining)
  const end = BigInt(row.reads.fullProfitUnlockDate)
  const now = max(BigInt(timestamp), BigInt(snapshotTimestamp))
  const last = row.reads.lastProfitUpdate ?? row.reads.lastReport
  if (supply <= 0n || shares < 0n || locked < 0n || shares + locked !== supply)
    throw new Error('Invalid share inventory')
  const unlocked = BigInt(row.reads.unlockedShares)
  const rate = BigInt(row.reads.profitUnlockingRate)
  const additional =
    locked === 0n || end === 0n
      ? 0n
      : now >= end
        ? locked
        : last === null
          ? null
          : min(locked, max(0n, (rate * (now - BigInt(last))) / SCALE - unlocked))
  if (additional === null) throw new Error('Unlock checkpoint unavailable')
  const denominator = supply - additional
  return denominator === 0n ? 0n : (BigInt(requestedShares) * assets) / denominator
}
export const projectedAssets = (row, snapshotTimestamp, timestamp) =>
  convertSharesAt(row, row.holderShares, snapshotTimestamp, timestamp)
export const toUsd = (row, assets) => {
  const price = row.price?.price
  const decimals = row.assetMetadata?.decimals
  return !Number.isFinite(price) || price <= 0 || !Number.isInteger(decimals)
    ? null
    : (Number(assets) / 10 ** decimals) * price
}
export const currentUsdPerSecond = (row, timestamp) => {
  if (row.version === 'v2') {
    const current = projectedAssets(row, timestamp, timestamp)
    const future = projectedAssets(row, timestamp, BigInt(timestamp) + 60n)
    const difference = Number(future - current) / 60
    return Number.isFinite(row.price?.price) ? (difference / 10 ** row.assetMetadata.decimals) * row.price.price : null
  }

  const end = BigInt(row.reads.fullProfitUnlockDate)
  if (BigInt(timestamp) >= end || BigInt(row.lockedRemaining) === 0n) return toUsd(row, 0n)
  // d(A * H / S(t))/dt = A * H * unlockSharesPerSecond / S(t)^2.
  const assets = Number(row.reads.totalAssets)
  const holders = Number(row.holderShares)
  const supply = Number(row.reads.totalSupply)
  const assetRate = (assets * (holders / supply) * (Number(row.reads.profitUnlockingRate) / Number(SCALE))) / supply
  const price = row.price?.price
  return Number.isFinite(price) && price > 0 ? (assetRate / 10 ** row.assetMetadata.decimals) * price : null
}
