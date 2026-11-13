import fs from 'node:fs'
import { parseAbi } from 'viem'
import { batchRead, clientFor, original, read, t0, write } from './curation-common.mjs'

const snapshot = read('curation-snapshot.json')
const routes = read('curation-ownership-routes.json')
const plan = fs.existsSync(new URL('./curation-share-plan.json', import.meta.url))
  ? read('curation-share-plan.json')
  : []
const key = (chain, address) => `${chain}:${address.toLowerCase()}`
const chunks = (rows, size) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
const abi = parseAbi(['function convertToAssets(uint256) view returns(uint256)'])
const offsets =
  process.env.QUOTE_PHASE === 'baseline'
    ? [0]
    : [...new Set([0, 60, 3600, 86400, ...original.projection.points.map((point) => point.timestamp - t0)])].toSorted(
        (a, b) => a - b
      )
const output = await Promise.all(
  Object.entries(Object.groupBy(snapshot.selected, (row) => row.chainId)).map(async ([id, rows]) => {
    const chainId = Number(id)
    const client = clientFor(chainId)
    const block = snapshot.blocks.find((block) => block.chainId === chainId)
    const requests = rows.flatMap((row) => {
      const incoming = routes.positions
        .filter((route) => route.childChainId === chainId && route.child === row.address)
        .map((route) => route.sharesRaw)
      const planned = plan.find((entry) => key(entry.chainId, entry.address) === key(chainId, row.address))
      const external = planned?.externalSharesRaw
      const allocated = planned?.internalAllocationSharesRaw ?? []
      const amounts = [
        ...new Set(
          [row.holderShares, String(10n ** BigInt(row.reads.decimals)), ...incoming, ...allocated, external]
            .filter((value) => value !== undefined && value !== null)
            .map(String)
        )
      ]
      return amounts.map((shares) => ({ row, shares }))
    })
    const groups = await chunks(offsets, 4).reduce(async (previous, group) => {
      const earlier = await previous
      const results = await Promise.all(
        group.map(async (offset) => {
          const timestamp = t0 + offset
          const values = await batchRead(
            client,
            requests.map(({ row, shares }) => ({
              address: row.address,
              abi,
              functionName: 'convertToAssets',
              args: [BigInt(shares)]
            })),
            block,
            timestamp
          )
          return requests.map(({ row, shares }, i) => ({
            address: row.address,
            shares,
            timestamp,
            value: values[i].status === 'success' ? String(values[i].result) : null,
            error: values[i].status === 'success' ? null : 'contract-call-unavailable'
          }))
        })
      )
      return [...earlier, ...results.flat()]
    }, Promise.resolve([]))
    console.log(
      JSON.stringify({
        chainId,
        quotes: groups.length,
        failed: groups.filter((row) => row.value === null).length
      })
    )
    return { chainId, results: groups }
  })
)
const quotes = output.flatMap(({ chainId, results }) => results.map((result) => ({ ...result, chainId })))
snapshot.selected.forEach((row) => {
  const matches = quotes.filter((result) => key(result.chainId, result.address) === key(row.chainId, row.address))
  const conversions = { ...(row.conversions ?? {}) }
  matches.forEach((quote) => {
    conversions[quote.shares] = {
      ...conversions[quote.shares],
      [quote.timestamp]: quote.value
    }
  })
  row.conversions = conversions
  row.holderAssets = conversions[String(row.holderShares)]?.[t0] ?? null
  row.validated = row.stateValid && row.holderAssets !== null
})
write('curation-snapshot.json', snapshot)
write(
  process.env.QUOTE_PHASE === 'baseline'
    ? 'curation-baseline-verification.json'
    : 'curation-projection-verification.json',
  {
    method:
      'Authoritative fee-aware convertToAssets for exact requested share quantities, pinned state with future timestamp overrides; no state changes',
    asOfTimestamp: t0,
    passed: quotes.filter((quote) => quote.value !== null).length,
    failed: quotes.filter((quote) => quote.value === null).length,
    quotes
  }
)
