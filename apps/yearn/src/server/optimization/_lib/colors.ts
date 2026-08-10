const PALETTE = [
  '#0074D9',
  '#40D3A4',
  '#FFB800',
  '#F05138',
  '#0657F9',
  '#FFBF00',
  '#00A650',
  '#00796D',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
  '#d946ef'
]

function hashAddress(address: string): number {
  let hash = 5381
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 33) ^ address.charCodeAt(i)
  }
  return Math.abs(hash)
}

export function assignStrategyColors(addresses: string[]): Map<string, string> {
  const result = new Map<string, string>()
  const usedIndices = new Set<number>()

  for (const address of addresses) {
    let index = hashAddress(address) % PALETTE.length

    let attempts = 0
    while (usedIndices.has(index) && attempts < PALETTE.length) {
      index = (index + 1) % PALETTE.length
      attempts++
    }

    usedIndices.add(index)
    result.set(address, PALETTE[index])
  }

  return result
}
