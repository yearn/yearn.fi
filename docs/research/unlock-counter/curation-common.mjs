import fs from 'node:fs'
import { createPublicClient, defineChain, http } from 'viem'
import { arbitrum, base, fantom, katana, mainnet, optimism, polygon } from 'viem/chains'
export const directory = new URL('./', import.meta.url)
export const read = (name) => JSON.parse(fs.readFileSync(new URL(name, directory)))
export const write = (name, value) =>
  fs.writeFileSync(
    new URL(name, directory),
    JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? String(item) : item), 2) + '\n'
  )
export const original = read('pre-curation-pilot.json')
export const t0 = original.asOfTimestamp
export const configs = [mainnet, optimism, polygon, fantom, base, arbitrum, katana]
export const names = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  250: 'Fantom',
  8453: 'Base',
  42161: 'Arbitrum',
  747474: 'Katana',
  4663: 'Robinhood Chain',
  999: 'HyperEVM'
}
export const namespaces = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  250: 'fantom',
  8453: 'base',
  42161: 'arbitrum',
  747474: 'katana',
  4663: 'yeer',
  999: 'hyperliquid'
}
export const clientFor = (id) => {
  const rpc =
    (id === 1 ? process.env.ETHEREUM_RPC_URL : null) ||
    process.env[`NEXT_PUBLIC_RPC_URI_FOR_${id}`] ||
    (id === 999 ? 'https://rpc.hyperliquid.xyz/evm' : null) ||
    configs.find((chain) => chain.id === id)?.rpcUrls.default.http[0]
  if (!rpc) throw new Error(`No configured RPC for chain ${id}`)
  const chain =
    configs.find((chain) => chain.id === id) ||
    defineChain({
      id,
      name: names[id],
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpc] } }
    })
  return createPublicClient({
    chain,
    transport: http(rpc, { timeout: 45000, retryCount: 2 })
  })
}
export const pinnedBlock = async (id, client) => {
  const prior = original.chains.find((chain) => chain.chainId === id)
  if (prior) return { chainId: id, ...prior.sourceBlock }
  const head = await client.getBlock()
  const bracket = async (distance = 4096n) => {
    const block = await client.getBlock({
      blockNumber: head.number > distance ? head.number - distance : 0n
    })
    return block.timestamp <= BigInt(t0) ? block.number : bracket(distance * 2n)
  }
  const search = async (low, high) => {
    if (high - low <= 1n) return client.getBlock({ blockNumber: low })
    const mid = (low + high) / 2n
    const block = await client.getBlock({ blockNumber: mid })
    return block.timestamp <= BigInt(t0) ? search(mid, high) : search(low, mid)
  }
  const block = await search(await bracket(), head.number)
  return {
    chainId: id,
    number: String(block.number),
    hash: block.hash,
    timestamp: Number(block.timestamp)
  }
}
export const batchRead = async (client, contracts, block, time) => {
  if (!contracts.length) return []
  const options = {
    blockNumber: BigInt(block.number),
    ...(time === undefined ? {} : { blockOverrides: { time: BigInt(time) } })
  }
  if (client.chain.contracts?.multicall3) return client.multicall({ contracts, ...options, batchSize: 9000 })
  return Promise.all(
    contracts.map(async (contract) => {
      try {
        return {
          status: 'success',
          result: await client.readContract({ ...contract, ...options })
        }
      } catch (error) {
        return { status: 'failure', error: error.name }
      }
    })
  )
}
export const baseRows = original.chains.flatMap((chain) =>
  read(chain.artifacts.snapshot).rows.map((row) => ({
    ...row,
    version: row.version || 'v3',
    chainId: chain.chainId,
    chainName: chain.name,
    snapshotTimestamp: chain.sourceBlock.timestamp,
    blockNumber: chain.sourceBlock.number
  }))
)
