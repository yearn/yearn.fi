import { projectedAssets, toUsd } from './model.mjs'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const usd = (value) => (value === null || value === undefined ? 'Unavailable' : money.format(value))
const rate = (value) => (value === null || value === undefined ? 'Unavailable' : `$${value.toFixed(6)}`)
const select = (selector) => document.querySelector(selector)
try {
  const [snapshot, calculation, overlaps, metrics, pilot, originalPilot, expandedTrace] = await Promise.all(
    [
      'expanded-snapshot.json',
      'expanded-calculation.json',
      'overlap-trace.json',
      'metrics-summary.json',
      'expanded-pilot-depositor-value.json',
      'pilot-depositor-value.json',
      'expanded-overlap-trace.json'
    ].map(async (path) => {
      const response = await fetch(new URL(path, import.meta.url))
      if (!response.ok) throw new Error('Snapshot unavailable')
      return response.json()
    })
  )
  const sampleNames = [
    'USDC-1 yVault',
    'WETH-1 yVault',
    'Morpho Yearn OG USDC Compounder',
    'Yearn BOLD',
    'Staked yBOLD',
    'Compound V3 USD Lender',
    'Curve DOLA-sUSDe Factory yVault',
    'USDC yVault'
  ]
  const samples = sampleNames.map((name) => calculation.rows.find((row) => row.name === name))
  select('#snapshot-label').textContent =
    `State at ${new Date(Number(snapshot.timestamp) * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC')}, finalized Ethereum block ${snapshot.blockNumber}. Calculated from existing schedules, with no assumed future harvests.`
  const tableRow = (values) => {
    const tr = document.createElement('tr')
    values.forEach((value) => {
      const td = document.createElement('td')
      td.textContent = value
      tr.append(td)
    })
    return tr
  }
  const renderRows = (rows, target) =>
    select(target).replaceChildren(
      ...rows.map((row) =>
        tableRow([
          row.name,
          usd(row.holderValueUsd),
          rate(row.currentUsdPerSecond),
          usd(row.afterOneHour?.increaseUsd),
          usd(row.afterOneDay?.increaseUsd),
          usd(row.remainingUnlockUsd)
        ])
      )
    )
  renderRows(samples, '#sample')
  renderRows(calculation.rows, '#all')
  select('#thresholds').replaceChildren(
    ...snapshot.selection.thresholds.map((row) =>
      tableRow([usd(row.cutoffUsd), row.count, usd(row.grossInventoryTvlUsd)])
    )
  )
  const chainNames = { 1: 'Ethereum', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum', 747474: 'Katana' }
  select('#cutoff-lists').replaceChildren(
    ...snapshot.selection.thresholds.map((threshold, index, thresholds) => {
      const details = document.createElement('details')
      details.id = `cutoff-${threshold.cutoffUsd}`
      details.open = threshold.cutoffUsd === 10000
      const summary = document.createElement('summary')
      const next = thresholds[index + 1]?.cutoffUsd
      const vaults = threshold.vaults.filter((vault) => next === undefined || vault.tvl < next)
      summary.textContent = `${next ? `${usd(threshold.cutoffUsd)}–under ${usd(next)}` : `${usd(threshold.cutoffUsd)}+`} · ${vaults.length} vaults`
      const wrapper = document.createElement('div')
      wrapper.className = 'table-wrap'
      const table = document.createElement('table')
      const head = document.createElement('thead')
      const labels = document.createElement('tr')
      ;['Vault', 'Chain', 'Listed TVL', 'Contract'].forEach((label) => {
        const th = document.createElement('th')
        th.scope = 'col'
        th.textContent = label
        labels.append(th)
      })
      head.append(labels)
      const body = document.createElement('tbody')
      body.replaceChildren(
        ...vaults.map((vault) =>
          tableRow([vault.name, chainNames[vault.chainId] ?? String(vault.chainId), usd(vault.tvl), vault.address])
        )
      )
      table.append(head, body)
      wrapper.append(table)
      details.append(summary, wrapper)
      return details
    })
  )
  samples.forEach((row) => {
    const option = document.createElement('option')
    option.value = row.address
    option.textContent = row.name
    select('#vault').append(option)
  })
  const boundaryPairs = [
    ['USDC-1 yVault', 'USDC to USDS Depositor'],
    ['USDC-1 yVault', 'USDC to sUSDS Lender'],
    ['yvUSD', 'Morpho Yearn OG USDC Compounder'],
    ['Yearn BOLD', 'Liquity V2 WETH Stability Pool'],
    ['Staked yBOLD', 'Yearn BOLD']
  ]
  const period = (seconds) =>
    seconds === null
      ? 'Unavailable'
      : Number(seconds) === 0
        ? 'Immediate at report'
        : `${(Number(seconds) / 86400).toFixed(0)} days`
  select('#report-boundaries').replaceChildren(
    ...boundaryPairs.map(([parent, child]) => {
      const edge = overlaps.edges.find((item) => item.parentName === parent && item.childName === child)
      const gain =
        edge.sameAsset && edge.childAssetsIncreaseOverHour !== null && edge.price !== null
          ? (Number(edge.childAssetsIncreaseOverHour) / 10 ** edge.parentAssetDecimals) * edge.price
          : null
      return tableRow([
        `${parent} → ${child}`,
        period(edge.childMaxUnlockTime),
        period(edge.parentMaxUnlockTime),
        edge.sameAsset ? usd(gain) : 'Share-token underlying',
        edge.relationship === 'underlying-share-token'
          ? 'Underlying share price propagates'
          : edge.parentAssetsNow === edge.parentAssetsAfterHour
            ? 'Recorded assets unchanged until report'
            : 'Requires separate accounting'
      ])
    })
  )
  select('#metrics-boundary').textContent =
    `The inspected metrics API publication is dated ${new Date(metrics.asOfTimestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC')} and marks completeness as ${metrics.completeness.status}. The pilot is November 4. Historical ownership percentages cannot be applied to this newer snapshot; refresh or align both boundaries first.`
  select('#pilot-scope').textContent =
    `${pilot.scope.valuedRootCount} priced roots out of ${pilot.scope.selectedRootCount}: 25 original V3 roots plus 95 V2 roots, including 38 factory-tagged vaults and 48 funded retired V2 vaults. Values use the original November 4 snapshot; this is a scoped subtotal, not all-Yearn TVL.`
  select('#pilot-unavailable').textContent =
    `${pilot.coverage.unavailableRoots.length} selected roots have unavailable USD prices. A further ${pilot.coverage.cutoffUnknownCandidates.length} funded V2 candidates cannot be assigned to a TVL cutoff from the available price response.`
  select('#pilot-comparison').replaceChildren(
    ...[
      ['Original V3 pilot', originalPilot],
      ['Expanded V2/V3 pilot', pilot]
    ].map(([label, data]) =>
      tableRow([
        label,
        `${data.scope.valuedRootCount} / ${data.scope.selectedRootCount}`,
        usd(data.aggregate.knownSubtotalUsd),
        rate(data.aggregate.averageNextMinuteUsdPerSecond),
        usd(data.aggregate.nextHourIncreaseUsd)
      ])
    )
  )
  select('#pilot-missing-prices').replaceChildren(
    ...pilot.coverage.unavailableRoots.map((entry) => tableRow([entry.name, entry.reason, entry.address]))
  )
  select('#pilot-cutoff-unknown').replaceChildren(
    ...pilot.coverage.cutoffUnknownCandidates.map((entry) =>
      tableRow([entry.name, usd(entry.listedTvl), entry.address])
    )
  )
  select('#pilot-unadjusted').textContent = usd(pilot.aggregate.unadjustedKnownSubtotalUsd)
  select('#pilot-overlap').textContent = usd(pilot.aggregate.observedOverlapUsd)
  select('#pilot-rate').textContent = `${rate(pilot.aggregate.averageNextMinuteUsdPerSecond)} / s`
  select('#pilot-hour').textContent = usd(pilot.aggregate.nextHourIncreaseUsd)
  select('#pilot-day').textContent = usd(pilot.aggregate.next24HoursIncreaseUsd)
  select('#pilot-time').textContent =
    `Known depositor-value subtotal · ${pilot.scope.valuedRootCount} of ${pilot.scope.selectedRootCount} roots priced · fixed historical snapshot`
  select('#pilot-entries').replaceChildren(
    ...pilot.entries.map((entry) =>
      tableRow([
        `${entry.name} (${entry.version.toUpperCase()}${entry.isFactory ? ' factory' : ''}${entry.isRetired ? ', retired' : ''})`,
        usd(entry.unadjustedHolderValueUsd),
        usd(entry.observedOverlapUsd),
        usd(entry.adjustedHolderValueUsd),
        rate(entry.averageNextMinuteUsdPerSecond)
      ])
    )
  )
  const rootNames = new Map(pilot.entries.map((entry) => [entry.address, entry.name]))
  const holderNames = new Map(expandedTrace.children.map((child) => [child.address, child.name]))
  select('#pilot-allocations').replaceChildren(
    ...pilot.allocations.map((entry) =>
      tableRow([
        `${rootNames.get(entry.parent)} → ${rootNames.get(entry.holder) ?? holderNames.get(entry.holder) ?? entry.holder} → ${rootNames.get(entry.child)}`,
        entry.method === 'exact-direct-share-ownership' ? 'Exact direct shares' : 'Metrics funding budget',
        usd(entry.attributedHolderValueUsd)
      ])
    )
  )
  const paintPilot = () => {
    const timestamp = pilot.asOfTimestamp + Math.round(Number(select('#pilot-minutes').value) * 60)
    const points = pilot.projection.points
    const next = points.findIndex((point) => point.timestamp >= timestamp)
    const right = points[next < 0 ? points.length - 1 : next]
    const left = points[Math.max(0, (next < 0 ? points.length - 1 : next) - 1)]
    const fraction =
      right.timestamp === left.timestamp ? 0 : (timestamp - left.timestamp) / (right.timestamp - left.timestamp)
    select('#pilot-value').textContent = usd(
      left.knownSubtotalUsd + fraction * (right.knownSubtotalUsd - left.knownSubtotalUsd)
    )
    select('#pilot-elapsed').textContent = `${Number(select('#pilot-minutes').value).toFixed(1)} min`
  }
  select('#pilot-minutes').addEventListener('input', paintPilot)
  paintPilot()
  const paint = () => {
    const row = snapshot.rows.find((row) => row.address === select('#vault').value)
    const result = calculation.rows.find((item) => item.address === row.address)
    const seconds = BigInt(Math.round(Number(select('#hours').value) * 3600))
    const value = toUsd(row, projectedAssets(row, snapshot.timestamp, BigInt(snapshot.timestamp) + seconds))
    select('#value').textContent = usd(value)
    select('#increase').textContent = usd(value === null ? null : value - result.holderValueUsd)
    select('#rate').textContent = `${rate(result.currentUsdPerSecond)} / s`
    select('#remaining').textContent = usd(result.remainingUnlockUsd)
    select('#end').textContent = result.remainingSeconds
      ? `${(result.remainingSeconds / 3600).toFixed(2)} h`
      : 'No active unlock'
    select('#elapsed').textContent = `${Number(select('#hours').value).toFixed(1)} h`
  }
  select('#vault').addEventListener('change', paint)
  select('#hours').addEventListener('input', paint)
  select('#reset').addEventListener('click', () => {
    select('#hours').value = 0
    paint()
  })
  paint()
} catch (error) {
  select('#error').hidden = false
  select('#error').textContent = `Unable to load research: ${error.message}`
}
