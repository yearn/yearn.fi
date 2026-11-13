import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseAbi } from 'viem'
import { chainId, client } from './chain-config.mjs'
import { convertSharesAt } from './model.mjs'

const directory = new URL('./', import.meta.url)
const prefix = process.env.PILOT_PREFIX || `chain-${chainId}-`
const snapshot = JSON.parse(fs.readFileSync(new URL(`${prefix}snapshot.json`, directory)))
const abi = parseAbi([
  'function convertToAssets(uint256) view returns(uint256)',
  'function pricePerShare() view returns(uint256)'
])
const frames = await Promise.all(
  (process.env.NO_TIMESTAMP_OVERRIDES === '1' ? [0] : [0, 3600, 86400, 604800]).map(async (offset) => {
    const timestamp = BigInt(snapshot.timestamp) + BigInt(offset)
    const rows = snapshot.rows.filter((row) => row.validated)
    const results = await client.multicall({
      contracts: rows.map((row) => ({
        address: row.address,
        abi,
        functionName: row.version === 'v2' ? 'pricePerShare' : 'convertToAssets',
        args: row.version === 'v2' ? [] : [BigInt(row.holderShares)]
      })),
      blockNumber: BigInt(snapshot.blockNumber),
      ...(process.env.NO_TIMESTAMP_OVERRIDES === '1' ? {} : { blockOverrides: { time: timestamp } }),
      batchSize: 12000
    })
    return {
      timestamp: String(timestamp),
      checks: rows.map((row, i) => {
        const shares = row.version === 'v2' ? 10n ** BigInt(row.reads.decimals) : row.holderShares
        const expected = convertSharesAt(row, shares, snapshot.timestamp, timestamp)
        const actual = results[i].status === 'success' ? results[i].result : null
        return {
          chainId,
          address: row.address,
          name: row.name,
          version: row.version,
          expected: String(expected),
          actual: actual === null ? null : String(actual),
          matched: expected === actual
        }
      })
    }
  })
)
const checks = frames.flatMap((frame) => frame.checks)
const constantSchedules = snapshot.rows.every(
  (row) =>
    row.validated &&
    BigInt(row.lockedRemaining) === 0n &&
    convertSharesAt(row, row.holderShares, snapshot.timestamp, BigInt(snapshot.timestamp) + 604800n) ===
      BigInt(row.holderAssets)
)
if (process.env.NO_TIMESTAMP_OVERRIDES === '1')
  assert(constantSchedules, 'Cannot skip timestamp calls for an active unlock')
const output = {
  chainId,
  blockNumber: snapshot.blockNumber,
  blockHash: snapshot.blockHash,
  method:
    process.env.NO_TIMESTAMP_OVERRIDES === '1'
      ? 'Snapshot contract comparison without overrides; all schedules exhausted and constant future model verified separately. RPC timestamp overrides unsupported.'
      : 'Read-only pinned-state contract calls with timestamp overrides at snapshot, one hour, one day and seven days',
  futureValidation:
    process.env.NO_TIMESTAMP_OVERRIDES === '1'
      ? {
          mode: 'exhausted-schedule-proof',
          allSchedulesExhausted: constantSchedules,
          contractTimestampOverrides: 'unavailable'
        }
      : { mode: 'contract-timestamp-overrides' },
  passed: checks.filter((check) => check.matched).length,
  failed: checks.filter((check) => !check.matched).length,
  unsupported: snapshot.rows.filter((row) => !row.validated).map((row) => row.address),
  frames
}
fs.writeFileSync(new URL(`${prefix}verification.json`, directory), JSON.stringify(output, null, 2) + '\n')
console.log(JSON.stringify({ chainId, passed: output.passed, failed: output.failed, unsupported: output.unsupported }))
assert.equal(output.failed, 0, 'Chain projection differs from contract calls')
assert.equal(output.unsupported.length, 0, 'Selected contract model unsupported')
