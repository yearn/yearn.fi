import fs from 'node:fs'
import { parseAbi } from 'viem'
import { chain, chainId, client, priceNamespace } from './chain-config.mjs'
import { convertSharesAt } from './model.mjs'

const directory = new URL('./', import.meta.url)
const prefix = process.env.PILOT_PREFIX || `chain-${chainId}-`
const original = JSON.parse(fs.readFileSync(new URL('expanded-snapshot.json', directory)))
const target = BigInt(original.timestamp)
const inventory = JSON.parse(fs.readFileSync(process.env.INVENTORY_FILE || '/tmp/unlock-inventory.json'))
const scope = inventory.filter(
  (v) =>
    v.chainId === chainId &&
    v.inclusion?.isYearn &&
    !v.isHidden &&
    (v.v3
      ? v.type === 'Yearn Vault' && !v.isRetired
      : String(v.apiVersion || '').startsWith('0.') && ['Yearn Vault', 'Automated Yearn Vault'].includes(v.type))
)
const head = await client.getBlock()
const findBlock = async (low, high) => {
  if (high - low <= 1n) return client.getBlock({ blockNumber: low })
  const midpoint = (low + high) / 2n
  const block = await client.getBlock({ blockNumber: midpoint })
  return block.timestamp <= target ? findBlock(midpoint, high) : findBlock(low, midpoint)
}
const bracket = async (distance = 4096n) => {
  const number = head.number > distance ? head.number - distance : 0n
  const lower = await client.getBlock({ blockNumber: number })
  return lower.timestamp <= target ? lower.number : bracket(distance * 2n)
}
const block = head.timestamp <= target ? head : await findBlock(await bracket(), head.number)
if (target - block.timestamp > 300n) throw new Error('Snapshot alignment exceeds five minutes')
console.log(chain.name, 'block', String(block.number), 'timestamp', String(block.timestamp), 'screened', scope.length)
const abi = parseAbi([
  'function totalAssets() view returns(uint256)',
  'function totalSupply() view returns(uint256)',
  'function balanceOf(address) view returns(uint256)',
  'function asset() view returns(address)',
  'function token() view returns(address)',
  'function decimals() view returns(uint256)',
  'function lastReport() view returns(uint256)',
  'function lastProfitUpdate() view returns(uint256)',
  'function lockedProfit() view returns(uint256)',
  'function lockedProfitDegradation() view returns(uint256)',
  'function lockedProfitDegration() view returns(uint256)',
  'function apiVersion() view returns(string)',
  'function pricePerShare() view returns(uint256)',
  'function convertToAssets(uint256) view returns(uint256)',
  'function unlockedShares() view returns(uint256)',
  'function profitUnlockingRate() view returns(uint256)',
  'function fullProfitUnlockDate() view returns(uint256)',
  'function profitMaxUnlockTime() view returns(uint256)',
  'function get_default_queue() view returns(address[])',
  'function withdrawalQueue(uint256) view returns(address)'
])
const common = ['totalAssets', 'totalSupply', 'balanceOf', 'decimals', 'apiVersion', 'lastReport']
const functions = (v) => [
  ...common,
  ...(v.v3
    ? [
        'asset',
        'lastProfitUpdate',
        'unlockedShares',
        'profitUnlockingRate',
        'fullProfitUnlockDate',
        'profitMaxUnlockTime',
        'get_default_queue'
      ]
    : ['token', 'lockedProfit', 'lockedProfitDegradation', 'lockedProfitDegration', 'pricePerShare'])
]
const calls = scope.flatMap((v) =>
  functions(v).map((fn) => ({ address: v.address, abi, functionName: fn, args: fn === 'balanceOf' ? [v.address] : [] }))
)
const results = await client.multicall({ contracts: calls, blockNumber: block.number, batchSize: 12000 })
const offsets = scope.map((_, i) => scope.slice(0, i).reduce((sum, v) => sum + functions(v).length, 0))
const raw = scope.map((v, i) => ({
  metadata: v,
  reads: Object.fromEntries(
    functions(v).map((fn, j) => [
      fn === 'token' ? 'asset' : fn,
      results[offsets[i] + j].status === 'success' ? results[offsets[i] + j].result : null
    ])
  )
}))
const assets = [
  ...new Set(
    raw
      .filter((row) => row.reads.totalAssets > 0n)
      .map((row) => row.reads.asset)
      .filter(Boolean)
  )
]
const quotes = await Promise.all(
  Array.from({ length: Math.ceil(assets.length / 25) }, (_, i) => assets.slice(i * 25, (i + 1) * 25)).map(
    async (batch) => {
      const response = await fetch(
        `https://coins.llama.fi/prices/historical/${block.timestamp}/${batch.map((asset) => `${priceNamespace}:${asset}`).join(',')}`
      )
      if (!response.ok) throw new Error(`Price lookup failed on ${chain.name}`)
      return response.json()
    }
  )
)
const coins = Object.assign({}, ...quotes.map((quote) => quote.coins))
const rows = raw.map(({ metadata: v, reads: rawReads }) => {
  const noLock = !v.v3 && rawReads.apiVersion === '0.3.0'
  const r = v.v3
    ? rawReads
    : {
        ...rawReads,
        lockedProfit: noLock ? 0n : rawReads.lockedProfit,
        lockedProfitDegradation: noLock ? 0n : (rawReads.lockedProfitDegradation ?? rawReads.lockedProfitDegration)
      }
  const required = v.v3
    ? ['totalAssets', 'totalSupply', 'balanceOf', 'unlockedShares', 'profitUnlockingRate', 'fullProfitUnlockDate']
    : [
        'totalAssets',
        'totalSupply',
        'balanceOf',
        'lastReport',
        'lockedProfit',
        'lockedProfitDegradation',
        'pricePerShare'
      ]
  const supported = v.v3
    ? ['3.0.1', '3.0.2', '3.0.3', '3.0.4'].includes(r.apiVersion)
    : ['0.3.0', '0.3.2', '0.3.5', '0.4.2', '0.4.3', '0.4.5', '0.4.6'].includes(r.apiVersion)
  const valid =
    supported &&
    required.every((field) => r[field] !== null) &&
    r.totalSupply > 0n &&
    r.balanceOf <= r.totalSupply &&
    Number(r.decimals) === v.asset.decimals &&
    (v.v3 ? Boolean(r.lastProfitUpdate ?? r.lastReport) : r.totalAssets >= r.lockedProfit)
  const ratio = !v.v3 && valid ? (block.timestamp - r.lastReport) * r.lockedProfitDegradation : 0n
  const remaining = v.v3
    ? r.balanceOf
    : valid
      ? ratio >= 10n ** 18n
        ? 0n
        : r.lockedProfit - (r.lockedProfit * ratio) / 10n ** 18n
      : null
  const reads = v.v3
    ? r
    : {
        ...r,
        fullProfitUnlockDate:
          r.lockedProfitDegradation > 0n && r.lockedProfit > 0n
            ? r.lastReport + (10n ** 18n + r.lockedProfitDegradation - 1n) / r.lockedProfitDegradation
            : 0n,
        get_default_queue: []
      }
  const price = coins[`${priceNamespace}:${r.asset}`] ?? null
  const usablePrice =
    price &&
    price.price > 0 &&
    (price.confidence ?? 1) >= 0.9 &&
    Math.abs(Number(block.timestamp) - price.timestamp) <= 86400
      ? price
      : null
  const grossUsd =
    usablePrice && r.totalAssets !== null ? (Number(r.totalAssets) / 10 ** v.asset.decimals) * usablePrice.price : null
  const qualifies = grossUsd === null ? Number.isFinite(v.tvl) && v.tvl >= 10000 : grossUsd >= 10000
  const row = {
    chainId,
    address: v.address,
    name: v.name,
    kind: v.kind,
    version: v.v3 ? 'v3' : 'v2',
    vaultType: v.type,
    isFactory: v.type === 'Automated Yearn Vault',
    isRetired: Boolean(v.isRetired),
    apiVersion: r.apiVersion,
    rawReads,
    reads,
    normalization: noLock
      ? 'Version 0.3.0 has no profit lock'
      : !v.v3 && rawReads.lockedProfitDegradation === null
        ? 'Legacy lockedProfitDegration getter spelling'
        : 'Native getters',
    assetMetadata: v.asset,
    inventoryTvlUsd: v.tvl,
    holderShares: valid ? r.totalSupply - r.balanceOf : null,
    lockedRemaining: remaining,
    price: usablePrice,
    validated: valid,
    grossUsd,
    qualifies
  }
  const holderAssets = valid ? convertSharesAt(row, row.holderShares, block.timestamp, block.timestamp) : null
  return {
    ...row,
    holderAssets,
    eligibility: qualifies
      ? 'qualified'
      : r.totalAssets === 0n
        ? 'zero-assets'
        : grossUsd === null
          ? 'cutoff-unknown'
          : 'below-cutoff'
  }
})
const selected = rows.filter((row) => row.qualifies)
const checks = await client.multicall({
  contracts: selected.map((row) => ({
    address: row.address,
    abi,
    functionName: row.version === 'v2' ? 'pricePerShare' : 'convertToAssets',
    args: row.version === 'v2' ? [] : [BigInt(row.holderShares ?? 0)]
  })),
  blockNumber: block.number,
  batchSize: 12000
})
selected.forEach((row, i) => {
  const expected = row.validated
    ? row.version === 'v2'
      ? convertSharesAt(row, 10n ** BigInt(row.reads.decimals), block.timestamp, block.timestamp)
      : row.holderAssets
    : null
  row.capturedConversion = checks[i].status === 'success' ? checks[i].result : null
  row.validated = row.validated && row.capturedConversion === expected
})
const v2 = selected.filter((row) => row.version === 'v2')
const queues = await client.multicall({
  contracts: v2.flatMap((row) =>
    Array.from({ length: 20 }, (_, i) => ({
      address: row.address,
      abi,
      functionName: 'withdrawalQueue',
      args: [BigInt(i)]
    }))
  ),
  blockNumber: block.number,
  batchSize: 12000
})
v2.forEach((row, i) => {
  row.reads.get_default_queue = Array.from({ length: 20 }, (_, j) => queues[20 * i + j])
    .filter((result) => result.status === 'success' && result.result !== '0x0000000000000000000000000000000000000000')
    .map((result) => result.result)
})
const unknown = rows
  .filter((row) => row.eligibility === 'cutoff-unknown')
  .map((row) => ({
    chainId,
    address: row.address,
    name: row.name,
    totalAssets: row.reads.totalAssets,
    reason: row.reads.totalAssets === null ? 'state unavailable' : 'funded but USD price unavailable'
  }))
const output = {
  chainId,
  chainName: chain.name,
  capturedAt: new Date().toISOString(),
  targetTimestamp: target,
  timestamp: block.timestamp,
  blockNumber: block.number,
  blockHash: block.hash,
  sources: {
    inventory: 'Kong inventory retained from Ethereum pilot',
    prices: `DefiLlama historical ${priceNamespace} quotes`,
    rpc: 'Configured read-only chain RPC; endpoint omitted'
  },
  selection: {
    cutoffUsd: 10000,
    pilotLabel: `Closed ${chain.name} V2/V3 pilot, $10k cutoff`,
    screenedCount: rows.length,
    v2CutoffUnknown: unknown,
    criteria:
      'Visible Yearn V3 active roots and visible V2 including funded retired vaults; pinned gross USD value or listed TVL fallback for unpriced roots'
  },
  rows: selected,
  directCandidateHoldings: [],
  screened: rows,
  pricePayload: { coins }
}
fs.writeFileSync(
  new URL(`${prefix}snapshot.json`, directory),
  JSON.stringify(output, (_, value) => (typeof value === 'bigint' ? String(value) : value), 2) + '\n'
)
console.log(
  JSON.stringify({
    chainId,
    screened: rows.length,
    selected: selected.length,
    v2: v2.length,
    priced: selected.filter((row) => row.price).length,
    invalid: selected.filter((row) => !row.validated).map((row) => ({ name: row.name, apiVersion: row.apiVersion })),
    unknownCutoff: unknown.length
  })
)
