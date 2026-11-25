import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createGlobalModel, nodeKey } from './global-model.mjs'

const read = (name) => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)))
const pilot = read('./pre-curation-pilot.json')
const old = read('./multichain-chain-local-pilot.json')
const routes = read('./db-ownership-routes.json')
const inputs = read('./global-pilot-ledger-inputs.json')
const rows = pilot.chains.flatMap((chain) => {
  const snapshot = read(chain.artifacts.snapshot)
  return snapshot.rows.map((row) => ({
    ...row,
    version: row.version || 'v3',
    chainId: chain.chainId,
    snapshotTimestamp: Number(snapshot.timestamp)
  }))
})
const model = createGlobalModel(rows, pilot.asOfTimestamp)
const near = (a, b, tolerance = 0.00001) => assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`)
const child = '0x80c34bd3a3569e126e7055831036aa7b212cb159'
test('updated graph identities are revalidated at pinned source and destination blocks', () => {
  assert.equal(pilot.ownershipGraph.datasetId, routes.ownershipDatasetId)
  assert.equal(pilot.ownershipGraph.pilotTimestamp, old.asOfTimestamp)
  assert.equal(routes.positions.length, 48)
  assert.equal(routes.coverage.unavailableRoutes, 0)
  routes.positions.forEach((route) => {
    assert.equal(route.balanceRead, 'success')
    assert.notEqual(route.debtRead, 'unavailable')
    const source = pilot.chains.find((chain) => chain.chainId === route.parentChainId).sourceBlock
    const destination = pilot.chains.find((chain) => chain.chainId === route.childChainId).sourceBlock
    assert.equal(route.sourceBlock.hash, source.hash)
    assert.equal(route.childBlock.hash, destination.hash)
  })
  const cross = routes.positions.filter((route) => route.parentChainId !== route.childChainId)
  assert.equal(cross.length, 1)
  assert.equal(cross[0].child, child)
  assert.equal(cross[0].holder, '0xefeebaacdc5640a123fe282652503ea4fd499d14')
  assert.equal(cross[0].observedSharesRaw, '907045043491')
})
test('cross-chain source debt and child value are rebuilt instead of copying older DB dollars', () => {
  const position = inputs.positions.find((entry) => entry.chain_id === 1 && entry.child_chain_id === 747474)
  const route = routes.positions.find((entry) => entry.parentChainId !== entry.childChainId)
  const source = model.roots.get(nodeKey(1, route.parent))
  const destination = model.roots.get(nodeKey(747474, child))
  near(Number(position.debt_usd), model.usdValueAt(source, route.debtRaw))
  near(Number(position.owned_usd), model.shareValueAt(destination, route.observedSharesRaw))
  const graph = read('./db-ownership-graph.json')
  const oldEdge = graph.edges.find((edge) => edge.id === route.graphEdgeId)
  assert(Math.abs(Number(position.owned_usd) - oldEdge.tvlUsd) > 50)
})
test('unified attribution conserves child shares and remote-holder budgets across all chains', () => {
  const groups = Map.groupBy(pilot.allocations, (entry) => `${entry.childChainId}:${entry.child}:${entry.holder}`)
  groups.forEach((positions) => {
    const allocated = positions.reduce((sum, entry) => sum + BigInt(entry.attributedSharesRaw ?? '0'), 0n)
    assert(allocated <= BigInt(positions[0].observedSharesRaw))
  })
  pilot.entries.forEach((entry) => {
    const incoming = pilot.allocations
      .filter((position) => position.childChainId === entry.chainId && position.child === entry.address)
      .reduce((sum, position) => sum + BigInt(position.attributedSharesRaw ?? '0'), 0n)
    assert.equal(incoming, BigInt(entry.attributedInternalSharesRaw))
    assert.equal(incoming + BigInt(entry.attributedExternalSharesRaw), BigInt(entry.nonSelfHolderSharesRaw))
    assert(BigInt(entry.attributedExternalSharesRaw) >= 0n)
  })
})
test('only verified cross-chain-held vbUSDC shares change the previous pilot', () => {
  assert.equal(pilot.entries.length, old.entries.length)
  assert.equal(pilot.scope.valuedRootCount, 125)
  assert.equal(pilot.coverage.unavailableRoots.length, 32)
  assert.equal(pilot.aggregate.completeValueUsd, null)
  const changed = pilot.comparisonWithChainLocal.changedRoots
  assert.equal(changed.length, 1)
  assert.equal(changed[0].address, child)
  const cross = pilot.allocations.find((entry) => entry.parentChainId !== entry.childChainId)
  assert.equal(cross.attributedSharesRaw, cross.canonicalAllocatedSharesRaw)
  assert(BigInt(cross.attributedSharesRaw) < BigInt(cross.observedSharesRaw))
  const capped = inputs.positions.find((position) => position.chain_id !== position.child_chain_id)
  near(cross.attributedHolderValueUsd, Number(capped.debt_usd))
  near(old.aggregate.knownSubtotalUsd - pilot.aggregate.knownSubtotalUsd, cross.attributedHolderValueUsd)
  near(
    pilot.aggregate.averageNextMinuteUsdPerSecond - old.aggregate.averageNextMinuteUsdPerSecond,
    changed[0].rateUsdPerSecond - changed[0].previousRateUsdPerSecond
  )
  assert(pilot.aggregate.averageNextMinuteUsdPerSecond < old.aggregate.averageNextMinuteUsdPerSecond)
})
test('baseline, every curve point, and rate value the same frozen external shares', () => {
  const valued = pilot.entries.filter((entry) => entry.status === 'valued')
  const valueAt = (timestamp) =>
    valued.reduce(
      (sum, entry) =>
        sum +
        model.shareValueAt(
          model.roots.get(nodeKey(entry.chainId, entry.address)),
          entry.attributedExternalSharesRaw,
          timestamp
        ),
      0
    )
  pilot.projection.points.forEach((point) => {
    near(point.knownSubtotalUsd, valueAt(point.timestamp))
  })
  near(pilot.aggregate.knownSubtotalUsd, valueAt(pilot.asOfTimestamp))
  near(
    pilot.aggregate.averageNextMinuteUsdPerSecond,
    (valueAt(pilot.asOfTimestamp + 60) - valueAt(pilot.asOfTimestamp)) / 60
  )
  near(pilot.aggregate.nextHourIncreaseUsd, valueAt(pilot.asOfTimestamp + 3600) - valueAt(pilot.asOfTimestamp))
  near(pilot.aggregate.next24HoursIncreaseUsd, valueAt(pilot.asOfTimestamp + 86400) - valueAt(pilot.asOfTimestamp))
})
