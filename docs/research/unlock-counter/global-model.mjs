import { convertSharesAt } from './model.mjs'

export const nodeKey = (chainId, address) => `${chainId}:${address.toLowerCase()}`
export const createGlobalModel = (rows, timestamp) => {
  const roots = new Map(rows.map((row) => [nodeKey(row.chainId, row.address), row]))
  const priceAt = (row, time, seen = new Set()) => {
    const key = nodeKey(row.chainId, row.address)
    if (seen.has(key)) throw new Error('Cyclic share-token valuation')
    const child = roots.get(nodeKey(row.chainId, row.reads.asset))
    if (!child) return Number.isFinite(row.price?.price) && row.price.price > 0 ? row.price.price : null
    const childPrice = priceAt(child, time, new Set([...seen, key]))
    if (childPrice === null) return null
    const converted = convertSharesAt(child, 10n ** BigInt(row.assetMetadata.decimals), child.snapshotTimestamp, time)
    return (Number(converted) / 10 ** child.assetMetadata.decimals) * childPrice
  }
  const usdValueAt = (row, units, time = timestamp) => {
    const price = priceAt(row, time)
    return price === null ? null : (Number(units) / 10 ** row.assetMetadata.decimals) * price
  }
  const shareValueAt = (row, shares, time = timestamp) =>
    usdValueAt(row, convertSharesAt(row, shares, row.snapshotTimestamp, time), time)
  return { roots, priceAt, usdValueAt, shareValueAt }
}
