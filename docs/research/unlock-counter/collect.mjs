import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const directory = new URL('./', import.meta.url)
const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com')
})
const abi = parseAbi([
  'function totalAssets() view returns(uint256)',
  'function totalSupply() view returns(uint256)',
  'function balanceOf(address) view returns(uint256)',
  'function unlockedShares() view returns(uint256)',
  'function profitUnlockingRate() view returns(uint256)',
  'function fullProfitUnlockDate() view returns(uint256)',
  'function profitMaxUnlockTime() view returns(uint256)',
  'function lastProfitUpdate() view returns(uint256)',
  'function lastReport() view returns(uint256)',
  'function apiVersion() view returns(string)',
  'function asset() view returns(address)',
  'function decimals() view returns(uint8)',
  'function convertToAssets(uint256) view returns(uint256)',
  'function get_default_queue() view returns(address[])'
])
const inventory = await fetch('https://kong.yearn.fi/api/rest/list/vaults').then((r) => {
  if (!r.ok) throw new Error('Inventory unavailable')
  return r.json()
})
const scope = inventory.filter(
  (v) => v.v3 && v.inclusion?.isYearn && v.type === 'Yearn Vault' && !v.isHidden && !v.isRetired
)
const thresholds = [1000, 10000, 25000, 100000].map((cutoffUsd) => {
  const rows = scope.filter((v) => Number.isFinite(v.tvl) && v.tvl >= cutoffUsd)
  return {
    cutoffUsd,
    count: rows.length,
    vaults: rows
      .toSorted((a, b) => b.tvl - a.tvl || a.chainId - b.chainId || a.address.localeCompare(b.address))
      .map((v) => ({
        chainId: v.chainId,
        address: v.address,
        name: v.name,
        tvl: v.tvl,
        kind: v.kind,
        apiVersion: v.apiVersion
      })),
    grossInventoryTvlUsd: rows.reduce((sum, v) => sum + v.tvl, 0),
    byChain: Object.fromEntries(
      Object.entries(Object.groupBy(rows, (v) => v.chainId)).map(([chainId, vaults]) => [chainId, vaults.length])
    )
  }
})
const candidates = scope.filter((v) => v.chainId === 1 && Number.isFinite(v.tvl) && v.tvl >= 10000)
const block = await client.getBlock(
  process.env.SNAPSHOT_BLOCK ? { blockNumber: BigInt(process.env.SNAPSHOT_BLOCK) } : { blockTag: 'finalized' }
)
console.log('Pinned Ethereum block', String(block.number), 'candidates', candidates.length)
const call = (address, functionName, args = []) => ({ address, abi, functionName, args })
const functions = [
  'totalAssets',
  'totalSupply',
  'balanceOf',
  'unlockedShares',
  'profitUnlockingRate',
  'fullProfitUnlockDate',
  'profitMaxUnlockTime',
  'lastProfitUpdate',
  'lastReport',
  'apiVersion',
  'asset',
  'decimals',
  'get_default_queue'
]
const readResults = await client.multicall({
  contracts: candidates.flatMap((v) => functions.map((f) => call(v.address, f, f === 'balanceOf' ? [v.address] : []))),
  blockNumber: block.number,
  batchSize: 4000
})
const rawRows = candidates.map((v, index) => ({
  metadata: v,
  reads: Object.fromEntries(
    functions.map((f, offset) => {
      const result = readResults[index * functions.length + offset]
      return [f, result.status === 'success' ? result.result : null]
    })
  )
}))
const assets = [...new Set(rawRows.map((r) => r.reads.asset).filter(Boolean))]
const pricePayload = await fetch(
  `https://coins.llama.fi/prices/historical/${block.timestamp}/${assets.map((a) => `ethereum:${a}`).join(',')}`
).then((r) => {
  if (!r.ok) throw new Error('Prices unavailable')
  return r.json()
})
const conversionResults = await client.multicall({
  contracts: rawRows.flatMap(({ metadata: v, reads: r }) => {
    // Versioned V3 allocator and Tokenized Strategy getters both subtract unlocked self shares.
    const lockedRemaining = r.balanceOf
    const held = lockedRemaining === null || r.totalSupply === null ? 0n : r.totalSupply - lockedRemaining
    return [call(v.address, 'convertToAssets', [held]), call(v.address, 'convertToAssets', [r.totalSupply || 0n])]
  }),
  blockNumber: block.number,
  batchSize: 4000
})
const rows = rawRows.map(({ metadata: v, reads: r }, i) => {
  const lockedRemaining = r.balanceOf
  const holderShares = r.totalSupply === null || lockedRemaining === null ? null : r.totalSupply - lockedRemaining
  const holderAssets = conversionResults[2 * i].status === 'success' ? conversionResults[2 * i].result : null
  const allAssets = conversionResults[2 * i + 1].status === 'success' ? conversionResults[2 * i + 1].result : null
  const price = pricePayload.coins?.[`ethereum:${r.asset}`] ?? null
  return {
    address: v.address,
    name: v.name,
    kind: v.kind,
    apiVersion: v.apiVersion,
    inventoryTvlUsd: v.tvl,
    assetMetadata: v.asset,
    reads: r,
    lockedRemaining,
    holderShares,
    holderAssets,
    conversionAtSupply: allAssets,
    price,
    validated:
      holderShares !== null &&
      holderShares >= 0n &&
      lockedRemaining >= 0n &&
      holderAssets !== null &&
      r.totalSupply > 0n &&
      allAssets === r.totalAssets &&
      ['3.0.2', '3.0.3', '3.0.4'].includes(r.apiVersion) &&
      r.apiVersion === v.apiVersion
  }
})
const holderPairs = candidates.flatMap((parent) =>
  candidates
    .filter((child) => child.address !== parent.address)
    .map((child) => ({ parent: parent.address, child: child.address }))
)
const holdings = await client.multicall({
  contracts: holderPairs.map(({ parent, child }) => call(child, 'balanceOf', [parent])),
  blockNumber: block.number,
  batchSize: 4000
})
const overlaps = holderPairs.flatMap((pair, i) =>
  holdings[i].status === 'success' && holdings[i].result > 0n ? [{ ...pair, shares: holdings[i].result }] : []
)
const snapshot = {
  capturedAt: new Date().toISOString(),
  blockNumber: block.number,
  blockHash: block.hash,
  timestamp: block.timestamp,
  chainId: 1,
  sources: {
    inventory: 'https://kong.yearn.fi/api/rest/list/vaults',
    prices: `https://coins.llama.fi/prices/historical/${block.timestamp}/...`,
    rpc: 'Configured Ethereum read-only RPC (endpoint omitted)'
  },
  selection: {
    cutoffUsd: 10000,
    criteria: 'V3, inclusion.isYearn, type=Yearn Vault, not hidden, not retired; Ethereum pilot',
    thresholds,
    missingInventoryPrices: scope
      .filter((v) => !Number.isFinite(v.tvl))
      .map((v) => ({ chainId: v.chainId, address: v.address, name: v.name }))
  },
  rows,
  directCandidateHoldings: overlaps,
  pricePayload
}
fs.writeFileSync(
  new URL('snapshot.json', directory),
  JSON.stringify(snapshot, (_, v) => (typeof v === 'bigint' ? String(v) : v), 2) + '\n'
)
console.log('Validated rows', rows.filter((r) => r.validated).length, 'direct holdings', overlaps.length)
rows.forEach((r) => {
  console.log(
    r.name,
    r.validated ? 'valid' : 'unsupported',
    'remaining',
    String(r.lockedRemaining),
    'end',
    String(r.reads.fullProfitUnlockDate),
    'price',
    r.price?.price ?? 'missing'
  )
})
