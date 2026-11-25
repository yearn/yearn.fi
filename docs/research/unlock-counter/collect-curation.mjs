import fs from 'node:fs'
import path from 'node:path'
import { parseAbi } from 'viem'
import { batchRead, clientFor, names, namespaces, pinnedBlock, read, t0, write } from './curation-common.mjs'

if (!process.env.CURATION_CATALOGUE_FILE && !process.env.METRICS_SOURCE)
  throw new Error('Set METRICS_SOURCE or CURATION_CATALOGUE_FILE for the DB event catalogue')
const catalogue = JSON.parse(
  fs.readFileSync(
    process.env.CURATION_CATALOGUE_FILE ||
      path.join(process.env.METRICS_SOURCE, 'src/yearn_data/inventories/envio-curation-scope.json')
  )
)
const graph = read('db-ownership-graph.json')
const nodes = new Map(graph.nodes.filter((node) => node.category === 'curation').map((node) => [node.id, node]))
const unavailable = new Set(graph.diagnostics.unavailableNodes.map((row) => row.nodeId))
const contracts = catalogue.contracts.filter(
  (row) =>
    ['morpho-v1', 'morpho-v2'].includes(row.family) &&
    (nodes.has(`${row.chainId}:${row.address.toLowerCase()}`) ||
      unavailable.has(`${row.chainId}:${row.address.toLowerCase()}`))
)
const abi = parseAbi([
  'function name() view returns(string)',
  'function asset() view returns(address)',
  'function totalSupply() view returns(uint256)',
  'function totalAssets() view returns(uint256)',
  'function balanceOf(address) view returns(uint256)',
  'function decimals() view returns(uint8)',
  'function maxRate() view returns(uint256)',
  'function lastUpdate() view returns(uint256)',
  'function performanceFee() view returns(uint256)',
  'function managementFee() view returns(uint256)',
  'function fee() view returns(uint256)'
])
const functions = [
  'name',
  'asset',
  'totalSupply',
  'totalAssets',
  'balanceOf',
  'decimals',
  'maxRate',
  'lastUpdate',
  'performanceFee',
  'managementFee',
  'fee'
]
const output = await Promise.all(
  Object.entries(Object.groupBy(contracts, (row) => row.chainId)).map(async ([key, candidates]) => {
    const chainId = Number(key)
    const client = clientFor(chainId)
    const block = await pinnedBlock(chainId, client)
    const results = await batchRead(
      client,
      candidates.flatMap((row) =>
        functions.map((functionName) => ({
          address: row.address,
          abi,
          functionName,
          args: functionName === 'balanceOf' ? [row.address] : []
        }))
      ),
      block
    )
    const rows = candidates.map((row, i) => {
      const reads = Object.fromEntries(
        functions.map((fn, j) => [
          fn,
          results[i * functions.length + j].status === 'success' ? results[i * functions.length + j].result : null
        ])
      )
      return {
        chainId,
        chainName: names[chainId],
        address: row.address.toLowerCase(),
        name: reads.name || nodes.get(`${chainId}:${row.address.toLowerCase()}`)?.name || row.address,
        version: row.family,
        category: 'curation',
        snapshotTimestamp: Number(block.timestamp),
        blockNumber: block.number,
        reads,
        inventoryTvlUsd: nodes.get(`${chainId}:${row.address.toLowerCase()}`)?.rawTvlUsd ?? null
      }
    })
    const assets = [...new Set(rows.map((row) => row.reads.asset).filter(Boolean))]
    const decimals = await batchRead(
      client,
      assets.map((address) => ({ address, abi, functionName: 'decimals' })),
      block
    )
    const coins = assets.length
      ? await fetch(
          `https://coins.llama.fi/prices/historical/${block.timestamp}/${assets.map((address) => `${namespaces[chainId]}:${address}`).join(',')}`
        ).then(async (response) => {
          if (!response.ok) throw new Error(`Historical prices failed on chain ${chainId}`)
          return (await response.json()).coins
        })
      : {}
    const enriched = rows.map((row) => {
      const index = assets.indexOf(row.reads.asset)
      const decimal = index >= 0 && decimals[index].status === 'success' ? Number(decimals[index].result) : null
      const quote = coins[`${namespaces[chainId]}:${row.reads.asset}`] ?? null
      const price =
        quote && quote.price > 0 && (quote.confidence ?? 1) >= 0.9 && Math.abs(t0 - quote.timestamp) <= 86400
          ? quote
          : null
      const gross =
        price && decimal !== null && row.reads.totalAssets !== null
          ? (Number(row.reads.totalAssets) / 10 ** decimal) * price.price
          : null
      const stateValid =
        ['asset', 'totalAssets', 'totalSupply', 'balanceOf', 'decimals'].every((field) => row.reads[field] !== null) &&
        row.reads.totalSupply > 0n &&
        row.reads.balanceOf <= row.reads.totalSupply
      return {
        ...row,
        reads: { ...row.reads, fullProfitUnlockDate: '0' },
        assetMetadata: { address: row.reads.asset, decimals: decimal },
        price,
        grossUsd: gross,
        qualifies: gross === null ? (row.inventoryTvlUsd ?? 0) >= 10000 : gross >= 10000,
        stateValid,
        validated: false,
        holderShares: stateValid ? row.reads.totalSupply - row.reads.balanceOf : null,
        eligibility:
          gross === null
            ? row.reads.totalAssets === 0n
              ? 'zero-assets'
              : 'cutoff-unknown'
            : gross >= 10000
              ? 'qualified'
              : 'below-cutoff'
      }
    })
    console.log(
      JSON.stringify({
        chainId,
        screened: enriched.length,
        selected: enriched.filter((row) => row.qualifies).length,
        priced: enriched.filter((row) => row.qualifies && row.price).length
      })
    )
    return { chainId, block, rows: enriched }
  })
)
const rows = output.flatMap((group) => group.rows)
write('curation-snapshot.json', {
  generatedAt: new Date().toISOString(),
  asOfTimestamp: t0,
  selection: {
    cutoffUsd: 10000,
    criteria:
      'Morpho V1/V2 deployments in the metrics curation catalogue, pinned gross USD value >=$10k; metrics listed gross qualifies unpriced candidates'
  },
  blocks: output.map((group) => group.block),
  rows,
  selected: rows.filter((row) => row.qualifies),
  cutoffUnknown: rows.filter((row) => row.eligibility === 'cutoff-unknown' && !row.qualifies)
})
