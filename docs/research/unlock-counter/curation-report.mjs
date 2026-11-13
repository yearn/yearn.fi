const select = (selector) => document.querySelector(selector)
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})
const usd = (value) => (value === null || value === undefined ? 'Unavailable' : money.format(value))
const rate = (value) => (value === null || value === undefined ? 'Unavailable' : `$${value.toFixed(6)}`)
const names = {
  v2: 'Yearn V2',
  v3: 'Yearn V3',
  'morpho-v1': 'Morpho V1',
  'morpho-v2': 'Morpho V2'
}
const row = (values) => {
  const tr = document.createElement('tr')
  values.forEach((value) => {
    const td = document.createElement('td')
    td.textContent = value
    tr.append(td)
  })
  return tr
}
const interpolate = (points, time) => {
  const index = points.findIndex((point) => point.timestamp >= time)
  if (index < 0) throw new Error('Projection expired')
  const right = points[index]
  const left = points[Math.max(0, index - 1)]
  const weight = right.timestamp === left.timestamp ? 0 : (time - left.timestamp) / (right.timestamp - left.timestamp)
  return left.knownSubtotalUsd + weight * (right.knownSubtotalUsd - left.knownSubtotalUsd)
}
try {
  const response = await fetch(new URL('curation-pilot-depositor-value.json', import.meta.url))
  if (!response.ok) throw new Error('Snapshot unavailable')
  const data = await response.json()
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'long'
  }).format(new Date(data.asOfTimestamp * 1000))
  select('#scope').textContent =
    `${data.scope.valuedRootCount} valued roots out of ${data.scope.selectedRootCount}, including ${data.scope.curationRootCount} curation additions. Historical snapshot: ${time}.`
  select('#families').replaceChildren(
    ...data.families.map((family) =>
      row([
        names[family.version],
        `${family.priced} / ${family.selected}`,
        usd(family.aggregate.knownSubtotalUsd),
        rate(family.aggregate.averageNextMinuteUsdPerSecond),
        usd(family.aggregate.nextHourIncreaseUsd)
      ])
    )
  )
  select('#curation').replaceChildren(
    ...data.entries
      .filter((entry) => entry.version.startsWith('morpho-'))
      .map((entry) =>
        row([
          `${entry.name} · ${entry.chainName}`,
          names[entry.version],
          usd(entry.unadjustedHolderValueUsd),
          usd(entry.observedOverlapUsd),
          usd(entry.adjustedHolderValueUsd),
          rate(entry.averageNextMinuteUsdPerSecond)
        ])
      )
  )
  select('#comparison').textContent =
    `Previous known subtotal: ${usd(data.comparisonWithPreCuration.aggregate.knownSubtotalUsd)}. Adding curation changes it by ${usd(data.comparisonWithPreCuration.valueChangeUsd)}. Growth includes ${rate(data.growthComponents.yearnScheduledUnlockUsdPerSecond)}/second of scheduled Yearn unlocking and ${rate(data.growthComponents.morphoProjectedNetAccrualUsdPerSecond)}/second of projected Morpho net accrual.`
  const paint = () => {
    const family = select('#family').value
    const scope = family === 'all' ? data : data.families.find((item) => item.version === family)
    const entries = data.entries.filter((entry) => family === 'all' || entry.version === family)
    const time = data.asOfTimestamp + Math.round(Number(select('#minutes').value) * 60)
    select('#value').textContent = usd(interpolate(scope.projection.points, time))
    select('#elapsed').textContent = `${Number(select('#minutes').value).toFixed(1)} min`
    select('#rate').textContent = `${rate(scope.aggregate.averageNextMinuteUsdPerSecond)} / s`
    select('#hour').textContent = usd(scope.aggregate.nextHourIncreaseUsd)
    select('#day').textContent = usd(scope.aggregate.next24HoursIncreaseUsd)
    select('#overlap').textContent = usd(scope.aggregate.observedOverlapUsd)
    select('#coverage').textContent =
      `${entries.filter((entry) => entry.status === 'valued').length} / ${entries.length} selected roots valued. Missing values remain unavailable.`
    select('#entries').replaceChildren(
      ...entries.map((entry) =>
        row([
          `${entry.name} · ${entry.chainName}`,
          names[entry.version],
          usd(entry.adjustedHolderValueUsd),
          rate(entry.averageNextMinuteUsdPerSecond)
        ])
      )
    )
    select('#unavailable').replaceChildren(
      ...entries
        .filter((entry) => entry.status !== 'valued')
        .map((entry) => row([`${entry.name} · ${entry.chainName}`, entry.reason, entry.address]))
    )
  }
  select('#family').addEventListener('change', paint)
  select('#minutes').addEventListener('input', paint)
  paint()
} catch (error) {
  select('#error').hidden = false
  select('#error').textContent = error.message
}
