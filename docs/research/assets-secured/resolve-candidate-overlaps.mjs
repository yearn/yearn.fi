import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'

const dir = new URL('./', import.meta.url)
const dated = JSON.parse(fs.readFileSync(new URL('dated-candidates.json', dir)))
const graph = JSON.parse(fs.readFileSync(new URL('baseline-graph.json', dir)))
const c = createPublicClient({ transport: http(process.env.ARCHIVE_RPC_URL_1 || process.env.ETH_RPC_URL) })
const blockNumber = BigInt(dated.blockNumber)
const abi = parseAbi([
  'function strategyState() view returns(address)',
  'function vault() view returns(address)',
  'function yVault() view returns(address)',
  'function compounderVault() view returns(address)',
  'function yearnVault() view returns(address)',
  'function asset() view returns(address)',
  'function balanceOf(address) view returns(uint256)',
  'function totalSupply() view returns(uint256)',
  'function totalAssets() view returns(uint256)',
  'function valueOfVault() view returns(uint256)',
  'function balanceOfAsset() view returns(uint256)'
])
const read = (address, functionName, args = []) =>
  c.readContract({ address, abi, functionName, args, blockNumber }).catch(() => null)
const parents = dated.rows.filter((r) => r.grossUsd > 0)
const holders = [...new Set(parents.flatMap((r) => [r.address, ...(r.queue || [])]))]
const known = new Map(
  graph.nodes
    .filter((n) => n.chainId === 1 && n.nodeType === 'vault' && n.category !== 'curation')
    .map((n) => [n.address.toLowerCase(), n])
)
dated.rows.forEach((r) => {
  if (!known.has(r.address.toLowerCase()))
    known.set(r.address.toLowerCase(), { address: r.address, rawTvlUsd: r.grossUsd })
})
const records = await Promise.all(
  holders.map(async (holder) => {
    const getters = Object.fromEntries(
      await Promise.all(
        [
          'strategyState',
          'vault',
          'yVault',
          'compounderVault',
          'yearnVault',
          'asset',
          'totalAssets',
          'valueOfVault',
          'balanceOfAsset'
        ].map(async (f) => [f, await read(holder, f)])
      )
    )
    const directTargets = parents.find((p) => p.address.toLowerCase() === holder.toLowerCase())?.queue || []
    const targets = [
      ...new Set(
        [
          ...directTargets,
          ...['strategyState', 'vault', 'yVault', 'compounderVault', 'yearnVault', 'asset']
            .map((k) => getters[k])
            .filter((a) => a && known.has(a.toLowerCase()))
        ].filter((a) => known.has(a.toLowerCase()))
      )
    ]
    const positions = await Promise.all(
      targets.map(async (target) => {
        const [shares, supply] = await Promise.all([read(target, 'balanceOf', [holder]), read(target, 'totalSupply')])
        const tvl = known.get(target.toLowerCase()).rawTvlUsd
        return {
          target,
          shares,
          supply,
          ownedUsd: shares !== null && supply > 0n && tvl !== null ? (Number(shares) / Number(supply)) * tvl : null
        }
      })
    )
    return { holder, getters, positions }
  })
)
fs.writeFileSync(
  new URL('candidate-overlaps.json', dir),
  JSON.stringify({ blockNumber: dated.blockNumber, records }, (_, v) => (typeof v === 'bigint' ? String(v) : v), 2)
)
console.log(
  records
    .filter((r) => r.positions.some((p) => p.ownedUsd > 1))
    .map((r) => ({ holder: r.holder, positions: r.positions }))
)
