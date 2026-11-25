import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'

const directory = new URL('./', import.meta.url)
const graph = JSON.parse(fs.readFileSync(new URL('baseline-graph.json', directory)))
const inventory = JSON.parse(fs.readFileSync(new URL('hidden-vault-snapshots.json', directory))).rows
const client = createPublicClient({ transport: http(process.env.ARCHIVE_RPC_URL_1 || process.env.ETH_RPC_URL) })
const timestamp = BigInt(graph.asOfTimestamp)
const findBlock = async (low, high) => {
  if (high - low <= 1n) return low
  const mid = (low + high) / 2n
  const block = await client.getBlock({ blockNumber: mid })
  return block.timestamp <= timestamp ? findBlock(mid, high) : findBlock(low, mid)
}
const block = await findBlock(26000000n, await client.getBlockNumber())
const abi = parseAbi([
  'function totalAssets() view returns(uint256)',
  'function asset() view returns(address)',
  'function decimals() view returns(uint8)',
  'function symbol() view returns(string)',
  'function get_default_queue() view returns(address[])',
  'function vault() view returns(address)',
  'function yVault() view returns(address)',
  'function compounderVault() view returns(address)',
  'function yearnVault() view returns(address)'
])
const octant = JSON.parse(fs.readFileSync(new URL('octant-deployments.json', directory)))
const candidates = [
  ...inventory.filter((v) => v.chainId === 1).map((v) => ({ address: v.address, name: v.name })),
  { address: '0x8db2350d78abc13f5673a411d4700bcf87864dde', name: 'swBTC' },
  ...octant.logs.map((l) => ({ address: l.args.strategyAddress, name: l.args.vaultTokenName, octant: true }))
]
const unique = [...new Map(candidates.map((v) => [v.address.toLowerCase(), v])).values()]
const read = async (address, functionName) =>
  client.readContract({ address, abi, functionName, blockNumber: block }).catch(() => null)
const rows = await Promise.all(
  unique.map(async (v) => {
    const [totalAssets, asset, queue, vault, yVault, compounderVault, yearnVault] = await Promise.all(
      ['totalAssets', 'asset', 'get_default_queue', 'vault', 'yVault', 'compounderVault', 'yearnVault'].map((f) =>
        read(v.address, f)
      )
    )
    const decimals = asset ? await read(asset, 'decimals') : null
    return { ...v, totalAssets, asset, decimals, queue, vault, yVault, compounderVault, yearnVault }
  })
)
const assets = [...new Set(rows.map((r) => r.asset).filter(Boolean))]
const priceResponse = await fetch(
  'https://coins.llama.fi/prices/historical/' + timestamp + '/' + assets.map((a) => 'ethereum:' + a).join(',')
).then((r) => r.json())
const valued = rows.map((r) => {
  const price = priceResponse.coins?.['ethereum:' + r.asset]
  return {
    ...r,
    price: price ?? null,
    grossUsd:
      r.totalAssets !== null && r.decimals !== null && price
        ? (Number(r.totalAssets) / 10 ** Number(r.decimals)) * price.price
        : null
  }
})
fs.writeFileSync(
  new URL('dated-candidates.json', directory),
  JSON.stringify(
    { asOfTimestamp: String(timestamp), blockNumber: String(block), priceSource: 'coins.llama.fi', rows: valued },
    (_, v) => (typeof v === 'bigint' ? String(v) : v),
    2
  )
)
console.log('valued', valued.filter((v) => v.grossUsd !== null).length, 'of', valued.length, 'block', String(block))
