import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'

const dir = new URL('./', import.meta.url)
const graph = JSON.parse(fs.readFileSync(new URL('baseline-graph.json', dir)))
const candidates = JSON.parse(fs.readFileSync(new URL('dated-candidates.json', dir)))
const inventory = JSON.parse(fs.readFileSync(new URL('kong-vaults.json', dir)))
const abi = parseAbi([
  'function balanceOf(address) view returns(uint256)',
  'function totalSupply() view returns(uint256)'
])
const c = createPublicClient({ transport: http(process.env.ARCHIVE_RPC_URL_1 || process.env.ETH_RPC_URL) })
const base = graph.nodes.filter((n) => n.chainId === 1 && n.category !== 'curation')
const assets = base
  .map(
    (n) => inventory.find((v) => v.chainId === 1 && v.address.toLowerCase() === n.address.toLowerCase())?.asset?.address
  )
  .filter(Boolean)
const holders = [...new Set([...base.map((n) => n.address), ...assets].map((a) => a.toLowerCase()))]
const targets = candidates.rows.filter(
  (r) => r.grossUsd > 100000 && !r.name.includes('Katana') && !r.name.includes('Recovery')
)
const results = await Promise.all(
  targets.map(async (r) => {
    const calls = holders.map((h) => ({ address: r.address, abi, functionName: 'balanceOf', args: [h] }))
    const balances = await c.multicall({
      contracts: calls,
      blockNumber: BigInt(candidates.blockNumber),
      batchSize: 30000,
      multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11'
    })
    const supply = await c.readContract({
      address: r.address,
      abi,
      functionName: 'totalSupply',
      blockNumber: BigInt(candidates.blockNumber)
    })
    return {
      target: r.address,
      name: r.name,
      supply,
      failures: balances.filter((b) => b.status !== 'success').length,
      positions: balances.flatMap((b, i) =>
        b.status === 'success' && b.result > 0n
          ? [
              {
                holder: holders[i],
                shares: b.result,
                ownedUsd: (Number(b.result) / Number(supply)) * r.grossUsd,
                kind: base.some((n) => n.address.toLowerCase() === holders[i])
                  ? 'baseline-node'
                  : 'baseline-asset-contract'
              }
            ]
          : []
      )
    }
  })
)
fs.writeFileSync(
  new URL('incoming-holdings.json', dir),
  JSON.stringify(
    { blockNumber: candidates.blockNumber, holderCount: holders.length, results },
    (_, v) => (typeof v === 'bigint' ? String(v) : v),
    2
  )
)
console.log(results)
