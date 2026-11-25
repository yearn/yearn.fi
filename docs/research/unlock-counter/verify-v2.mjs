import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'
import { convertSharesAt } from './model.mjs'

const directory = new URL('./', import.meta.url)
const snapshot = JSON.parse(fs.readFileSync(new URL('v2-snapshot.json', directory)))
const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com')
})
const abi = parseAbi(['function pricePerShare() view returns(uint256)'])
const frames = await Promise.all(
  [0, 3600, 86400, 604800].map(async (offset) => {
    const timestamp = BigInt(snapshot.timestamp) + BigInt(offset)
    const results = await client.multicall({
      contracts: snapshot.selected.map((row) => ({ address: row.address, abi, functionName: 'pricePerShare' })),
      blockNumber: BigInt(snapshot.blockNumber),
      blockOverrides: { time: timestamp },
      batchSize: 12000
    })
    return {
      timestamp: String(timestamp),
      checks: snapshot.selected.map((row, i) => {
        const expected = convertSharesAt(row, 10n ** BigInt(row.reads.decimals), snapshot.timestamp, timestamp)
        const actual = results[i].status === 'success' ? results[i].result : null
        return {
          address: row.address,
          name: row.name,
          apiVersion: row.apiVersion,
          expected: String(expected),
          actual: actual === null ? null : String(actual),
          matched: expected === actual
        }
      })
    }
  })
)
const checks = frames.flatMap((frame) => frame.checks)
fs.writeFileSync(
  new URL('v2-verification.json', directory),
  JSON.stringify(
    {
      blockNumber: snapshot.blockNumber,
      method:
        'pricePerShare at original stored state with timestamp overrides, compared with version-specific free-funds model',
      passed: checks.filter((check) => check.matched).length,
      failed: checks.filter((check) => !check.matched).length,
      frames
    },
    null,
    2
  ) + '\n'
)
assert(
  checks.every((check) => check.matched),
  'V2 timestamped share-price validation failed'
)
console.log('V2 contract comparisons passed', checks.length)
