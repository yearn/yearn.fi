import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const directory = new URL('./', import.meta.url)
const base = JSON.parse(fs.readFileSync(new URL('snapshot.json', directory)))
const inventory = JSON.parse(fs.readFileSync(process.env.INVENTORY_FILE || '/tmp/unlock-inventory.json'))
const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com')
})
const abi = parseAbi([
  'function totalAssets() view returns(uint256)',
  'function totalSupply() view returns(uint256)',
  'function token() view returns(address)',
  'function balanceOf(address) view returns(uint256)',
  'function decimals() view returns(uint256)',
  'function lastReport() view returns(uint256)',
  'function lockedProfitDegration() view returns(uint256)',
  'function lockedProfit() view returns(uint256)',
  'function lockedProfitDegradation() view returns(uint256)',
  'function apiVersion() view returns(string)',
  'function pricePerShare() view returns(uint256)',
  'function withdrawalQueue(uint256) view returns(address)'
])
const scope = inventory.filter(
  (v) =>
    !v.v3 &&
    String(v.apiVersion || '').startsWith('0.') &&
    v.inclusion?.isYearn &&
    ['Yearn Vault', 'Automated Yearn Vault'].includes(v.type) &&
    !v.isHidden
)
const candidates = scope.filter((v) => v.chainId === 1)
const functions = [
  'totalAssets',
  'totalSupply',
  'token',
  'balanceOf',
  'decimals',
  'lastReport',
  'lockedProfit',
  'lockedProfitDegradation',
  'lockedProfitDegration',
  'apiVersion',
  'pricePerShare'
]
const calls = candidates.flatMap((v) =>
  functions.map((functionName) => ({
    address: v.address,
    abi,
    functionName,
    args: functionName === 'balanceOf' ? [v.address] : []
  }))
)
const results = await client.multicall({ contracts: calls, blockNumber: BigInt(base.blockNumber), batchSize: 12000 })
const raw = candidates.map((v, i) => ({
  metadata: v,
  reads: Object.fromEntries(
    functions.map((fn, j) => [
      fn === 'token' ? 'asset' : fn,
      results[i * functions.length + j].status === 'success' ? results[i * functions.length + j].result : null
    ])
  )
}))
const assets = [
  ...new Set(
    raw
      .filter((r) => r.reads.totalAssets !== null && r.reads.totalAssets > 0n)
      .map((r) => r.reads.asset)
      .filter(Boolean)
  )
]
const quotes = await Promise.all(
  Array.from({ length: Math.ceil(assets.length / 30) }, (_, index) => assets.slice(index * 30, (index + 1) * 30)).map(
    async (batch) => {
      const response = await fetch(
        `https://coins.llama.fi/prices/historical/${base.timestamp}/${batch.map((asset) => `ethereum:${asset}`).join(',')}`
      )
      if (!response.ok) throw new Error('V2 historical prices unavailable')
      return response.json()
    }
  )
)
const coins = Object.assign({}, ...quotes.map((quote) => quote.coins))
const rows = raw.map(({ metadata: v, reads: original }) => {
  const noLock = original.apiVersion === '0.3.0'
  const r = {
    ...original,
    lockedProfit: noLock ? 0n : original.lockedProfit,
    lockedProfitDegradation: noLock ? 0n : (original.lockedProfitDegradation ?? original.lockedProfitDegration)
  }

  const price = coins[`ethereum:${r.asset}`] ?? null
  const supported = ['0.3.0', '0.3.2', '0.3.5', '0.4.2', '0.4.3', '0.4.5', '0.4.6'].includes(r.apiVersion)
  const valid =
    supported &&
    [
      'totalAssets',
      'totalSupply',
      'balanceOf',
      'lastReport',
      'lockedProfit',
      'lockedProfitDegradation',
      'pricePerShare'
    ].every((field) => r[field] !== null) &&
    r.totalSupply > 0n &&
    r.totalAssets >= r.lockedProfit &&
    r.balanceOf <= r.totalSupply &&
    Number(r.decimals) === v.asset.decimals
  const elapsed = r.lastReport === null ? 0n : BigInt(base.timestamp) - r.lastReport
  const ratio = r.lockedProfitDegradation === null ? 0n : elapsed * r.lockedProfitDegradation
  const remaining = valid ? (ratio >= 10n ** 18n ? 0n : r.lockedProfit - (r.lockedProfit * ratio) / 10n ** 18n) : null
  const pps = valid ? ((r.totalAssets - remaining) * 10n ** BigInt(r.decimals)) / r.totalSupply : null
  const holderShares = valid ? r.totalSupply - r.balanceOf : null
  const holderAssets = valid ? (holderShares * (r.totalAssets - remaining)) / r.totalSupply : null
  const grossUsd =
    price && r.totalAssets !== null ? (Number(r.totalAssets) / 10 ** v.asset.decimals) * price.price : null
  const listedQualifies = Number.isFinite(v.tvl) && v.tvl >= 10000
  const qualifies = grossUsd === null ? listedQualifies : grossUsd >= 10000
  return {
    address: v.address,
    name: v.name,
    kind: 'Legacy',
    vaultType: v.type,
    version: 'v2',
    model: noLock ? 'v2-no-profit-lock' : 'v2-locked-profit',
    rawReads: original,
    normalization: noLock
      ? 'Version 0.3.0 has no profit-lock mechanism; derived locked profit and degradation are zero'
      : original.lockedProfitDegradation === null
        ? 'Legacy lockedProfitDegration getter spelling'
        : 'Native lockedProfitDegradation getter',
    isFactory: v.type === 'Automated Yearn Vault',
    isRetired: Boolean(v.isRetired),
    apiVersion: r.apiVersion,
    inventoryTvlUsd: v.tvl,
    assetMetadata: v.asset,
    reads: {
      ...r,
      fullProfitUnlockDate:
        r.lockedProfitDegradation > 0n && r.lockedProfit > 0n
          ? r.lastReport + (10n ** 18n + r.lockedProfitDegradation - 1n) / r.lockedProfitDegradation
          : 0n,
      get_default_queue: null
    },
    holderShares,
    holderAssets,
    lockedRemaining: remaining,
    price,
    validated: valid && pps === r.pricePerShare,
    grossUsd,
    qualifies,
    eligibility: qualifies
      ? grossUsd === null
        ? 'listed-TVL-qualified-price-unavailable'
        : 'pinned-price-qualified'
      : r.totalAssets === 0n
        ? 'zero-assets'
        : grossUsd === null && r.totalAssets !== null && r.totalAssets > 0n
          ? 'funded-price-unavailable-cutoff-unknown'
          : 'below-cutoff-or-unavailable-state'
  }
})
const selected = rows.filter((row) => row.qualifies)
const queues = await client.multicall({
  contracts: selected.flatMap((row) =>
    Array.from({ length: 20 }, (_, i) => ({
      address: row.address,
      abi,
      functionName: 'withdrawalQueue',
      args: [BigInt(i)]
    }))
  ),
  blockNumber: BigInt(base.blockNumber),
  batchSize: 12000
})
selected.forEach((row, i) => {
  row.reads.get_default_queue = Array.from({ length: 20 }, (_, j) => queues[20 * i + j])
    .filter((item) => item.status === 'success' && item.result !== '0x0000000000000000000000000000000000000000')
    .map((item) => item.result)
})
const output = {
  timestamp: base.timestamp,
  blockNumber: base.blockNumber,
  blockHash: base.blockHash,
  selection: {
    cutoffUsd: 10000,
    scope:
      'Visible inclusion.isYearn V2 Yearn Vault and Automated Yearn Vault entries, including funded retired vaults. Ethereum projection; other chains discovery-only.',
    ethereumScreened: rows.length,
    ethereumSelected: selected.length,
    ethereumFactorySelected: selected.filter((r) => r.isFactory).length,
    unknownCutoff: rows
      .filter((r) => r.eligibility === 'funded-price-unavailable-cutoff-unknown')
      .map((r) => ({
        address: r.address,
        name: r.name,
        totalAssets: r.reads.totalAssets,
        listedTvl: r.inventoryTvlUsd
      })),
    thresholds: [1000, 10000, 25000, 100000].map((cutoffUsd) => ({
      cutoffUsd,
      vaults: scope
        .filter((v) => Number.isFinite(v.tvl) && v.tvl >= cutoffUsd)
        .map((v) => ({
          chainId: v.chainId,
          address: v.address,
          name: v.name,
          tvl: v.tvl,
          kind: v.kind,
          apiVersion: v.apiVersion,
          type: v.type
        }))
    }))
  },
  rows,
  selected,
  pricePayload: { coins }
}
fs.writeFileSync(
  new URL('v2-snapshot.json', directory),
  JSON.stringify(output, (_, value) => (typeof value === 'bigint' ? String(value) : value), 2) + '\n'
)
console.log({
  screened: rows.length,
  selected: selected.length,
  factory: selected.filter((r) => r.isFactory).length,
  validatedSelected: selected.filter((r) => r.validated).length,
  pricedSelected: selected.filter((r) => r.price).length,
  unknownCutoff: output.selection.unknownCutoff.length
})
selected
  .filter((r) => !r.validated || !r.price)
  .forEach((r) => {
    console.log(r.name, 'validated', r.validated, 'price', r.price?.price ?? 'unavailable')
  })
