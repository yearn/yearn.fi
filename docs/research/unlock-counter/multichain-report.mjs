const select = (selector) => document.querySelector(selector)
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const usd = (value) => (value === null || value === undefined ? 'Unavailable' : money.format(value))
const rate = (value) => (value === null || value === undefined ? 'Unavailable' : `$${value.toFixed(6)}`)
const tableRow = (values) => {
  const row = document.createElement('tr')
  values.forEach((value) => {
    const cell = document.createElement('td')
    if (value instanceof Node) cell.append(value)
    else cell.textContent = value
    row.append(cell)
  })
  return row
}
const link = (title, href) => {
  const anchor = document.createElement('a')
  anchor.textContent = title
  anchor.href = href
  return anchor
}
const interpolate = (points, timestamp) => {
  const index = points.findIndex((point) => point.timestamp >= timestamp)
  if (index < 0) throw new Error('Projection validity exceeded')
  const right = points[index]
  const left = points[Math.max(0, index - 1)]
  const weight =
    left.timestamp === right.timestamp ? 0 : (timestamp - left.timestamp) / (right.timestamp - left.timestamp)
  return left.knownSubtotalUsd + weight * (right.knownSubtotalUsd - left.knownSubtotalUsd)
}
try {
  const response = await fetch(new URL('multichain-pilot-depositor-value.json', import.meta.url))
  if (!response.ok) throw new Error('Combined snapshot unavailable')
  const data = await response.json()
  const changes = data.comparisonWithPreCuration
  select('#ownership-update').textContent =
    `Curation integrated using DB graph ${data.ownershipGraph.datasetId.slice(0, 12)}: ${data.scope.curationRootCount} additional roots, ${data.coverage.verifiedOwnershipRoutes} verified ownership routes, including ${data.coverage.crossChainRoutes} cross-chain route. Previous Yearn-only subtotal: ${usd(changes.aggregate.knownSubtotalUsd)}; net curation addition: ${usd(changes.valueChangeUsd)}.`
  const chainPilots = new Map(
    await Promise.all(
      data.chains.map(async (chain) => {
        const result = await fetch(new URL(chain.artifacts.pilot, import.meta.url))
        if (!result.ok) throw new Error(`${chain.name} snapshot unavailable`)
        return [String(chain.chainId), await result.json()]
      })
    )
  )
  select('#scope').textContent =
    `${data.scope.valuedRootCount} valued roots out of ${data.scope.selectedRootCount} selected across ${data.chains.length} chains. Common snapshot: ${new Date(data.asOfTimestamp * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC')}. Estimated share-value growth combines scheduled Yearn unlocking and projected Morpho net accrual.`
  data.chains.forEach((chain) => {
    const option = document.createElement('option')
    option.value = String(chain.chainId)
    option.textContent = chain.name
    select('#chain').append(option)
  })
  select('#chains').replaceChildren(
    ...data.chains.map((chain) => {
      const unavailable = chain.scope.selectedRootCount > 0 && chain.scope.valuedRootCount === 0
      return tableRow([
        chain.name,
        `${chain.coverage.priced} / ${chain.coverage.selected}`,
        usd(unavailable ? null : chain.aggregate.knownSubtotalUsd),
        rate(unavailable ? null : chain.aggregate.averageNextMinuteUsdPerSecond),
        usd(unavailable ? null : chain.aggregate.observedOverlapUsd),
        usd(unavailable ? null : chain.aggregate.nextHourIncreaseUsd)
      ])
    })
  )
  select('#evidence').replaceChildren(
    ...data.chains.map((chain) => {
      const evidence = document.createElement('span')
      evidence.append(
        link('Snapshot', chain.artifacts.snapshot),
        ' · ',
        link('Ledger', chain.artifacts.ledger),
        ' · ',
        link('Yearn checks', chain.artifacts.verification ?? chain.artifacts.morphoVerification)
      )
      if (chain.artifacts.curationSnapshot)
        evidence.append(
          ' · ',
          link('Morpho snapshot', chain.artifacts.curationSnapshot),
          ' · ',
          link('Morpho conversions', chain.artifacts.morphoVerification)
        )
      return tableRow([
        chain.name,
        chain.sourceBlock.number,
        chain.sourceBlock.secondsBeforeCommonTimestamp ?? data.asOfTimestamp - Number(chain.sourceBlock.timestamp),
        chain.chainId === 250
          ? '9 snapshot checks; exhausted schedules'
          : `${chain.validation.passed} Yearn comparisons; ${chain.validation.morphoPassed} Morpho conversions`,
        evidence
      ])
    })
  )
  const names = new Map(data.entries.map((entry) => [`${entry.chainId}:${entry.address}`, entry.name]))
  const paint = () => {
    const filter = select('#chain').value
    const pilot = filter === 'all' ? data : chainPilots.get(filter)
    const selected = (row) => filter === 'all' || String(row.chainId) === filter
    const timestamp = data.asOfTimestamp + Math.round(Number(select('#minutes').value) * 60)
    const noValuation = pilot.scope.selectedRootCount > 0 && pilot.scope.valuedRootCount === 0
    select('#value').textContent = usd(noValuation ? null : interpolate(pilot.projection.points, timestamp))
    select('#elapsed').textContent = `${Number(select('#minutes').value).toFixed(1)} min`
    select('#rate').textContent = `${rate(noValuation ? null : pilot.aggregate.averageNextMinuteUsdPerSecond)} / s`
    select('#overlap').textContent = usd(noValuation ? null : pilot.aggregate.observedOverlapUsd)
    select('#hour').textContent = usd(noValuation ? null : pilot.aggregate.nextHourIncreaseUsd)
    select('#day').textContent = usd(noValuation ? null : pilot.aggregate.next24HoursIncreaseUsd)
    const componentRate = (morpho) => {
      const entries = data.entries.filter(selected).filter((entry) => entry.version.startsWith('morpho-') === morpho)
      return entries.length > 0 && entries.every((entry) => entry.status !== 'valued')
        ? null
        : entries.reduce((sum, entry) => sum + (entry.averageNextMinuteUsdPerSecond ?? 0), 0)
    }
    select('#yearn-rate').textContent = `${rate(componentRate(false))} / s`
    select('#morpho-rate').textContent = `${rate(componentRate(true))} / s`
    select('#coverage').textContent =
      `${pilot.scope.valuedRootCount} of ${pilot.scope.selectedRootCount} roots valued; ${pilot.coverage.unavailableRoots.length} selected values unavailable. ${pilot.coverage.cutoffUnknownCandidates.length} further candidates have unknown cutoff eligibility. Complete total: unavailable.`
    select('#entries').replaceChildren(
      ...data.entries
        .filter(selected)
        .map((entry) =>
          tableRow([
            `${entry.name} · ${entry.chainName} · ${entry.version.toUpperCase()}${entry.isFactory ? ' factory' : ''}${entry.isRetired ? ' · retired' : ''}`,
            usd(entry.unadjustedHolderValueUsd),
            usd(entry.observedOverlapUsd),
            usd(entry.adjustedHolderValueUsd),
            rate(entry.averageNextMinuteUsdPerSecond)
          ])
        )
    )
    select('#unavailable').replaceChildren(
      ...data.coverage.unavailableRoots
        .filter(selected)
        .map((entry) => tableRow([`${entry.name} · ${entry.chainName}`, entry.reason, entry.address]))
    )
    select('#unknown').replaceChildren(
      ...data.coverage.cutoffUnknownCandidates
        .filter(selected)
        .map((entry) =>
          tableRow([
            `${entry.name} · ${entry.chainName}`,
            entry.reason ?? 'Funded, USD asset price unavailable',
            entry.address
          ])
        )
    )
    const chainNames = new Map(data.chains.map((chain) => [chain.chainId, chain.name]))
    const label = (chainId, address) => `${names.get(`${chainId}:${address}`) ?? address} (${chainNames.get(chainId)})`
    select('#allocations').replaceChildren(
      ...data.allocations
        .filter((entry) => filter === 'all' || String(entry.childChainId ?? entry.chainId) === filter)
        .map((entry) => {
          const childChainId = entry.childChainId ?? entry.chainId
          return tableRow([
            `${label(entry.parentChainId ?? entry.chainId, entry.parent)} → ${label(childChainId, entry.holder)} → ${label(childChainId, entry.child)}`,
            entry.method === 'exact-direct-share-ownership'
              ? 'Exact direct shares'
              : entry.parentChainId !== childChainId
                ? 'Cross-chain funding budget'
                : 'Canonical funding budget',
            usd(entry.attributedHolderValueUsd)
          ])
        })
    )
  }
  select('#chain').addEventListener('change', paint)
  select('#minutes').addEventListener('input', paint)
  paint()
} catch (error) {
  select('#error').hidden = false
  select('#error').textContent = `Unable to load research: ${error.message}`
}
