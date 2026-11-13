import fs from 'node:fs'
import { parseAbi } from 'viem'
import { client } from './chain-config.mjs'

const directory = new URL('./', import.meta.url)
const prefix = process.env.PILOT_PREFIX || ''
const snapshot = JSON.parse(fs.readFileSync(new URL(`${prefix}snapshot.json`, directory)))
const trace = JSON.parse(fs.readFileSync(new URL(`${prefix}overlap-trace.json`, directory)))

const roots = snapshot.rows.map((row) => row.address.toLowerCase())
const holders = [...new Set([...roots, ...trace.edges.map((edge) => edge.child.toLowerCase())])]
const pairs = holders.flatMap((holder) => roots.filter((child) => child !== holder).map((child) => ({ holder, child })))
const abi = parseAbi(['function balanceOf(address) view returns(uint256)'])
const reads = await client.multicall({
  contracts: pairs.map(({ holder, child }) => ({ address: child, abi, functionName: 'balanceOf', args: [holder] })),
  blockNumber: BigInt(snapshot.blockNumber),
  batchSize: 24000
})
const positions = pairs.flatMap((pair, index) => {
  const result = reads[index]
  return result.status === 'success' && result.result === 0n
    ? []
    : [{ ...pair, shares: result.status === 'success' ? String(result.result) : null, status: result.status }]
})
const output = {
  timestamp: snapshot.timestamp,
  blockNumber: snapshot.blockNumber,
  blockHash: snapshot.blockHash,
  rootCount: roots.length,
  holderCount: holders.length,
  checkedPairs: pairs.length,
  zeroPairs: pairs.length - positions.length,
  coverage: `Closed pilot: ${roots.length} selected roots plus observed queue/direct holders. No ownership dollars or ratios reused from the older metrics publication.`,
  positions
}
fs.writeFileSync(new URL(`${prefix}internal-holdings.json`, directory), JSON.stringify(output, null, 2) + '\n')
console.log({
  checkedPairs: pairs.length,
  positive: positions.filter((p) => p.shares !== null).length,
  unavailable: positions.filter((p) => p.shares === null).length
})
