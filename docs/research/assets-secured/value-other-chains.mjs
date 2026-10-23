import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'

const dir = new URL('./', import.meta.url)
const input = JSON.parse(fs.readFileSync(new URL('hidden-vault-snapshots.json', dir))).rows.filter(
  (r) => r.chainId !== 1
)
const timestamp = 1792627199n
const urls = {
  8453: process.env.ARCHIVE_RPC_URL_8453 || process.env.BASE_RPC_URL,
  42161: process.env.ARCHIVE_RPC_URL_42161 || process.env.ARB_RPC_URL,
  100: process.env.ARCHIVE_RPC_URL_100 || process.env.GNOSIS_RPC_URL,
  146: 'https://rpc.soniclabs.com'
}
const names = { 8453: 'base', 42161: 'arbitrum', 100: 'xdai', 146: 'sonic' }
const abi = parseAbi([
  'function totalAssets() view returns(uint256)',
  'function asset() view returns(address)',
  'function decimals() view returns(uint8)'
])
const rows = (
  await Promise.all(
    Object.entries(urls).map(async ([chain, url]) => {
      const c = createPublicClient({ transport: http(url, { timeout: 10000, retryCount: 1 }) })
      const find = async (lo, hi) => {
        if (hi - lo <= 1n) return lo
        const mid = (lo + hi) / 2n
        const b = await c.getBlock({ blockNumber: mid })
        return b.timestamp <= timestamp ? find(mid, hi) : find(lo, mid)
      }
      try {
        const latest = await c.getBlockNumber()
        const block = await find(latest > 5000000n ? latest - 5000000n : 0n, latest)
        return await Promise.all(
          input
            .filter((r) => r.chainId === Number(chain))
            .map(async (r) => {
              try {
                const [assets, asset] = await Promise.all(
                  ['totalAssets', 'asset'].map((functionName) =>
                    c.readContract({ address: r.address, abi, functionName, blockNumber: block })
                  )
                )
                const decimals = await c.readContract({
                  address: asset,
                  abi,
                  functionName: 'decimals',
                  blockNumber: block
                })
                const key = names[chain] + ':' + asset
                const prices = await fetch('https://coins.llama.fi/prices/historical/' + timestamp + '/' + key).then(
                  (r) => r.json()
                )
                const price = prices.coins?.[key]
                return {
                  ...r,
                  blockNumber: String(block),
                  totalAssets: String(assets),
                  assetAddress: asset,
                  decimals,
                  price,
                  grossUsd: assets === 0n ? 0 : price ? (Number(assets) / 10 ** decimals) * price.price : null
                }
              } catch {
                return { address: r.address, chainId: r.chainId, status: 'read-unavailable' }
              }
            })
        )
      } catch {
        return input
          .filter((r) => r.chainId === Number(chain))
          .map((r) => ({ address: r.address, chainId: r.chainId, status: 'block-unavailable' }))
      }
    })
  )
).flat()
fs.writeFileSync(new URL('other-chains.json', dir), JSON.stringify({ asOfTimestamp: String(timestamp), rows }, null, 2))
console.log(rows.map((r) => ({ chain: r.chainId, name: r.name, value: r.grossUsd, status: r.status })))
