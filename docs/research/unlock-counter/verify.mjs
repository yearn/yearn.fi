import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'
import { projectedAssets } from './model.mjs'

const directory = new URL('./', import.meta.url)
const snapshot = JSON.parse(fs.readFileSync(new URL('snapshot.json', directory)))
const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com')
})
const abi = parseAbi(['function convertToAssets(uint256) view returns(uint256)'])
const results = await Promise.all(
  snapshot.rows.map(async (row) => {
    if (!row.validated) return { address: row.address, status: 'unsupported' }
    const timestamps = [
      BigInt(snapshot.timestamp),
      BigInt(snapshot.timestamp) + 3600n,
      BigInt(snapshot.timestamp) + 86400n,
      BigInt(row.reads.fullProfitUnlockDate) > BigInt(snapshot.timestamp)
        ? BigInt(row.reads.fullProfitUnlockDate) + 1n
        : BigInt(snapshot.timestamp) + 604800n
    ]
    const checks = await Promise.all(
      timestamps.map(async (timestamp) => {
        const expected = projectedAssets(row, snapshot.timestamp, timestamp)
        try {
          const actual = await client.readContract({
            address: row.address,
            abi,
            functionName: 'convertToAssets',
            args: [BigInt(row.holderShares)],
            blockNumber: BigInt(snapshot.blockNumber),
            blockOverrides: { time: timestamp }
          })
          assert.equal(actual, expected)
          return { timestamp: String(timestamp), expected: String(expected), actual: String(actual), status: 'matched' }
        } catch (error) {
          return { timestamp: String(timestamp), expected: String(expected), status: 'failed', reason: error.name }
        }
      })
    )
    return { address: row.address, name: row.name, checks }
  })
)
fs.writeFileSync(
  new URL('verification.json', directory),
  JSON.stringify(
    {
      blockNumber: snapshot.blockNumber,
      blockHash: snapshot.blockHash,
      method: 'Read-only eth_call at pinned state with block timestamp override; no transactions',
      results
    },
    null,
    2
  ) + '\n'
)
const checks = results.flatMap((r) => r.checks ?? [])
console.log({
  passed: checks.filter((c) => c.status === 'matched').length,
  failed: checks.filter((c) => c.status === 'failed').length
})
results
  .filter((r) => r.checks?.some((c) => c.status === 'failed'))
  .forEach((r) => {
    console.log(
      r.name,
      r.checks.filter((c) => c.status === 'failed')
    )
  })

if (checks.some((check) => check.status !== 'matched')) process.exitCode = 1
