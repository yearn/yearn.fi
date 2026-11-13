import fs from 'node:fs'
import { currentUsdPerSecond, projectedAssets, toUsd } from './model.mjs'

const directory = new URL('./', import.meta.url)
const prefix = process.env.PILOT_PREFIX || ''
const snapshot = JSON.parse(fs.readFileSync(new URL(`${prefix}snapshot.json`, directory)))
const timestamp = BigInt(snapshot.timestamp)
const rows = snapshot.rows.map((row) => {
  if (!row.validated) return { name: row.name, address: row.address, status: 'unavailable' }
  const baseline = projectedAssets(row, timestamp, timestamp)
  if (baseline !== BigInt(row.holderAssets)) throw new Error(`Conversion mismatch: ${row.name}`)
  const baselineUsd = toUsd(row, baseline)
  const after = (seconds) => {
    const assets = projectedAssets(row, timestamp, timestamp + BigInt(seconds))
    return {
      assets: String(assets),
      usd: toUsd(row, assets),
      increaseUsd: baselineUsd === null ? null : toUsd(row, assets) - baselineUsd
    }
  }
  return {
    name: row.name,
    address: row.address,
    kind: row.kind,
    apiVersion: row.apiVersion,
    assetSymbol: row.assetMetadata.symbol,
    status: baselineUsd === null ? 'price-unavailable' : 'valued',
    inventoryTvlUsd: row.inventoryTvlUsd,
    holderValueUsd: baselineUsd,
    currentUsdPerSecond: currentUsdPerSecond(row, timestamp),
    remainingSeconds: Math.max(0, Number(row.reads.fullProfitUnlockDate) - Number(timestamp)),
    remainingUnlockUsd:
      baselineUsd === null
        ? null
        : toUsd(row, projectedAssets(row, timestamp, timestamp + 366n * 86400n)) - baselineUsd,
    afterOneMinute: after(60),
    afterOneHour: after(3600),
    afterOneDay: after(86400),
    final: after(366 * 86400)
  }
})
fs.writeFileSync(
  new URL(`${prefix}calculation.json`, directory),
  JSON.stringify({ timestamp: String(timestamp), blockNumber: snapshot.blockNumber, rows }, null, 2) + '\n'
)
console.log('snapshot', new Date(Number(timestamp) * 1000).toISOString())
rows.forEach((row) => {
  console.log(
    row.name,
    JSON.stringify({
      value: row.holderValueUsd,
      perSecond: row.currentUsdPerSecond,
      oneHour: row.afterOneHour?.increaseUsd,
      oneDay: row.afterOneDay?.increaseUsd,
      remaining: row.remainingUnlockUsd,
      endHours: row.remainingSeconds / 3600
    })
  )
})
