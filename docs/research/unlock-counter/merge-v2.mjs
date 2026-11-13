import fs from 'node:fs'

const directory = new URL('./', import.meta.url)
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, directory)))
const original = read('snapshot.json')
const v2 = read('v2-snapshot.json')
const unsupported = v2.selected.filter((row) => !row.validated)
if (unsupported.length) throw new Error('Validate all selected V2 share models before expanding the pilot')
const rows = [
  ...original.rows.map((row) => ({ ...row, version: 'v3', isFactory: false, isRetired: false })),
  ...v2.selected
]
const thresholds = original.selection.thresholds.map((threshold, i) => {
  const vaults = [
    ...threshold.vaults.map((v) => ({ ...v, version: 'v3' })),
    ...v2.selection.thresholds[i].vaults.map((v) => ({ ...v, version: 'v2' }))
  ].toSorted((a, b) => b.tvl - a.tvl)
  return {
    cutoffUsd: threshold.cutoffUsd,
    count: vaults.length,
    grossInventoryTvlUsd: vaults.reduce((sum, v) => sum + v.tvl, 0),
    vaults
  }
})
const expanded = {
  ...original,
  selection: {
    ...original.selection,
    criteria:
      'Original active visible V3 roots plus visible V2 Yearn Vault and Automated Yearn Vault roots, including funded retired V2. Listed-TVL discovery across chains, pinned-state valuation on Ethereum.',
    thresholds,
    v2CutoffUnknown: v2.selection.unknownCutoff
  },
  rows,
  directCandidateHoldings: []
}
fs.writeFileSync(new URL('expanded-snapshot.json', directory), JSON.stringify(expanded, null, 2) + '\n')
console.log({
  roots: rows.length,
  v3: original.rows.length,
  v2: v2.selected.length,
  v2Factory: v2.selected.filter((row) => row.isFactory).length,
  retiredV2: v2.selected.filter((row) => row.isRetired).length
})
