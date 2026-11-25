import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (name) => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)))
const data = read('curation-pilot-depositor-value.json')
const prior = read('pre-curation-pilot.json')
const near = (actual, expected) => assert(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`)
test('primary combined data preserves every Yearn-only value and namespaces curation evidence', () => {
  assert.deepEqual(read('multichain-pilot-depositor-value.json'), data)
  assert.equal(read('global-pilot-ledger-inputs.json').rows.length, 157)
  assert.equal(read('curation-ledger-inputs.json').rows.length, 178)
  assert.equal(data.ownershipGraph.ledgerInputs, 'curation-ledger-inputs.json')
  assert.equal(data.ownershipGraph.ledgerAudit, 'curation-ledger-audit.json')
  prior.entries.forEach((old) => {
    const entry = data.entries.find((item) => item.chainId === old.chainId && item.address === old.address)
    assert.equal(entry.adjustedHolderValueUsd, old.adjustedHolderValueUsd)
    assert.equal(entry.attributedExternalSharesRaw, old.attributedExternalSharesRaw)
    assert.equal(entry.averageNextMinuteUsdPerSecond, old.averageNextMinuteUsdPerSecond)
  })
})
test('per-chain curation artifacts reconcile to the combined value and exact conversion evidence', () => {
  assert.equal(data.chains.length, 8)
  assert.equal(
    data.chains.reduce((sum, chain) => sum + chain.validation.morphoPassed, 0),
    4620
  )
  data.chains.forEach((chain) => {
    assert(chain.artifacts.pilot.startsWith('curation-chain-'))
    assert.equal(chain.artifacts.ledger, 'curation-ledger-audit.json')
    const pilot = read(chain.artifacts.pilot)
    assert.equal(pilot.entries.length, chain.scope.selectedRootCount)
    assert(pilot.entries.every((entry) => entry.chainId === chain.chainId))
    near(pilot.aggregate.knownSubtotalUsd, chain.aggregate.knownSubtotalUsd)
  })
  near(
    data.aggregate.knownSubtotalUsd,
    data.chains.reduce((sum, chain) => sum + chain.aggregate.knownSubtotalUsd, 0)
  )
  near(
    data.aggregate.averageNextMinuteUsdPerSecond,
    data.chains.reduce((sum, chain) => sum + chain.aggregate.averageNextMinuteUsdPerSecond, 0)
  )
  assert.equal(data.chains.find((chain) => chain.chainId === 4663).coverage.unavailable, 1)
})
test('standalone review embeds the current dataset and does not fetch it at runtime', () => {
  const page = fs.readFileSync(new URL('curation-preview.html', import.meta.url), 'utf8')
  const match = page.match(/<script id="pilot-data" type="application\/json">([\s\S]*?)<\/script>/)
  assert(match)
  assert.deepEqual(JSON.parse(match[1]), data)
  assert(!page.includes('const response = await fetch('))
  assert(!/<script[^>]*src=/.test(page))
  assert(page.includes('Morpho V2 buffer release and new interest are not separately attributed'))
})
