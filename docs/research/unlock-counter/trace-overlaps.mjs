import fs from 'node:fs'
import { parseAbi } from 'viem'
import { client } from './chain-config.mjs'

const directory = new URL('./', import.meta.url)
const prefix = process.env.PILOT_PREFIX || ''
const snapshot = JSON.parse(fs.readFileSync(new URL(`${prefix}snapshot.json`, directory)))

const abi = parseAbi([
  'function name() view returns(string)',
  'function apiVersion() view returns(string)',
  'function asset() view returns(address)',
  'function totalAssets() view returns(uint256)',
  'function totalSupply() view returns(uint256)',
  'function balanceOf(address) view returns(uint256)',
  'function convertToAssets(uint256) view returns(uint256)',
  'function profitMaxUnlockTime() view returns(uint256)',
  'function profitUnlockingRate() view returns(uint256)',
  'function fullProfitUnlockDate() view returns(uint256)',
  'function strategies(address) view returns(uint256 activation,uint256 last_report,uint256 current_debt,uint256 max_debt)'
])
const v2Abi = parseAbi([
  'function strategies(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
])
const v230Abi = parseAbi([
  'function strategies(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
])
const candidates = snapshot.rows
const lookup = new Map(candidates.map((row) => [row.address.toLowerCase(), row]))
const queuePairs = candidates.flatMap((row) =>
  (row.reads.get_default_queue ?? []).map((child) => ({ parent: row.address, child }))
)
const pairs = [
  ...new Map(
    [...queuePairs, ...snapshot.directCandidateHoldings].map(({ parent, child }) => [
      `${parent.toLowerCase()}:${child.toLowerCase()}`,
      { parent, child }
    ])
  ).values()
]
const childAddresses = [...new Set(pairs.map((pair) => pair.child.toLowerCase()))]
const names = [
  'name',
  'apiVersion',
  'asset',
  'totalAssets',
  'totalSupply',
  'profitMaxUnlockTime',
  'profitUnlockingRate',
  'fullProfitUnlockDate'
]
const call = (address, functionName, args = []) => ({ address, abi, functionName, args })
const blockNumber = BigInt(snapshot.blockNumber)
const results = await client.multicall({
  contracts: childAddresses.flatMap((address) => names.map((fn) => call(address, fn))),
  blockNumber,
  batchSize: 24000
})
const children = childAddresses.map((address, i) => ({
  address,
  ...Object.fromEntries(
    names.map((fn, offset) => [
      fn,
      results[i * names.length + offset].status === 'success' ? results[i * names.length + offset].result : null
    ])
  )
}))
const childLookup = new Map(children.map((child) => [child.address, child]))
const positions = await client.multicall({
  contracts: pairs.flatMap(({ parent, child }) => [
    call(child, 'balanceOf', [parent]),
    {
      ...call(parent, 'strategies', [child]),
      abi:
        lookup.get(parent.toLowerCase()).version === 'v2'
          ? lookup.get(parent.toLowerCase()).apiVersion === '0.3.0'
            ? v230Abi
            : v2Abi
          : abi
    }
  ]),
  blockNumber,
  batchSize: 24000
})
const withHoldings = pairs.map((pair, i) => ({
  ...pair,
  heldShares: positions[2 * i].status === 'success' ? positions[2 * i].result : null,
  recorded: positions[2 * i + 1].status === 'success' ? positions[2 * i + 1].result : null
}))
const conversions = await Promise.all(
  withHoldings.map(async (pair) => {
    if (process.env.SKIP_FUTURE === '1' || pair.heldShares === null)
      return { now: null, hour: null, parentHourAssets: null }
    const read = (address, fn, args, future) =>
      client
        .readContract({
          address,
          abi,
          functionName: fn,
          args,
          blockNumber,
          ...(future ? { blockOverrides: { time: BigInt(snapshot.timestamp) + 3600n } } : {})
        })
        .catch(() => null)
    const [now, hour, parentHourAssets] = await Promise.all([
      read(pair.child, 'convertToAssets', [pair.heldShares], false),
      read(pair.child, 'convertToAssets', [pair.heldShares], true),
      read(pair.parent, 'totalAssets', [], true)
    ])
    return { now, hour, parentHourAssets }
  })
)
const edges = withHoldings.map((pair, i) => {
  const parent = lookup.get(pair.parent.toLowerCase())
  const child = childLookup.get(pair.child.toLowerCase())
  const isUnderlying = parent.reads.asset.toLowerCase() === pair.child.toLowerCase()
  const registered = pair.recorded !== null && pair.recorded[parent.version === 'v2' ? 1 : 0] > 0n
  const conversion = conversions[i]
  const sameAsset =
    (child.asset ?? lookup.get(pair.child.toLowerCase())?.reads.asset)?.toLowerCase() ===
    parent.reads.asset.toLowerCase()
  const currentDebt = registered
    ? pair.recorded[parent.version === 'v2' ? (parent.apiVersion === '0.3.0' ? 5 : 6) : 2]
    : null
  return {
    parent: pair.parent,
    parentName: parent.name,
    child: pair.child,
    childName: child.name,
    childVersion: child.apiVersion,
    relationship: isUnderlying
      ? 'underlying-share-token'
      : registered && sameAsset
        ? 'report-gated-strategy'
        : 'unresolved-or-unregistered',
    heldShares: pair.heldShares,
    sameAsset,
    parentMaxUnlockTime: parent.reads.profitMaxUnlockTime,
    childMaxUnlockTime: child.profitMaxUnlockTime,
    childUnlockEnd: child.fullProfitUnlockDate,
    childUnlockRate: child.profitUnlockingRate,
    recordedDebt: currentDebt,
    childAssetsNow: conversion.now,
    childAssetsAfterHour: conversion.hour,
    childAssetsIncreaseOverHour:
      conversion.now !== null && conversion.hour !== null ? conversion.hour - conversion.now : null,
    unreportedDifferenceAssets: currentDebt !== null && conversion.now !== null ? conversion.now - currentDebt : null,
    parentAssetsNow: parent.reads.totalAssets,
    parentAssetsAfterHour: conversion.parentHourAssets,
    parentAssetDecimals: parent.assetMetadata.decimals,
    price: parent.price?.price ?? null
  }
})
const output = {
  timestamp: snapshot.timestamp,
  blockNumber: snapshot.blockNumber,
  blockHash: snapshot.blockHash,
  coverage: `${candidates.length} pilot roots: V3 default queues, V2 withdrawal queues, and observed direct holdings; not a complete historical strategy list or ownership ledger`,
  edges,
  children
}
fs.writeFileSync(
  new URL(`${prefix}overlap-trace.json`, directory),
  JSON.stringify(output, (_, value) => (typeof value === 'bigint' ? String(value) : value), 2) + '\n'
)
console.log('Traced edges', edges.length)
const chosen = ['USDC-1 yVault', 'yvUSD', 'Yearn BOLD', 'Staked yBOLD']
edges
  .filter((edge) => chosen.includes(edge.parentName))
  .forEach((edge) => {
    console.log(
      edge.parentName,
      '=>',
      edge.childName,
      edge.relationship,
      'maxUnlockSeconds',
      String(edge.childMaxUnlockTime),
      'holding',
      String(edge.heldShares),
      'child/hour',
      String(edge.childAssetsIncreaseOverHour),
      'parentAssetsUnchanged',
      edge.parentAssetsNow === String(edge.parentAssetsAfterHour)
    )
  })
