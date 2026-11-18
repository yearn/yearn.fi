import type { TWrapped } from '@yearn/wrapped-contract'

// Deliberately fictional, deterministic and loaded only by the explicit demo action.
export const demo: TWrapped = {
  version: 2,
  address: '0x0000000000000000000000000000000000000000',
  generatedAt: '2026-11-17T00:00:00.000Z',
  source: 'yearn-holdings',
  period: { year: 2026, start: '2026-01-01', end: '2026-11-16', partial: true },
  coverage: {
    isComplete: true,
    issues: [],
    chains: [
      { id: 1, name: 'ethereum' },
      { id: 8453, name: 'base' }
    ]
  },
  firstActivity: Date.UTC(2025, 3, 12) / 1000,
  return: {
    pct: 7.42,
    baselineDate: '2025-12-31',
    isComplete: true,
    points: Array.from({ length: 320 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      value: 100 + (7.42 * index) / 319
    }))
  },
  vaults: [
    {
      chainId: 1,
      address: '0x1111111111111111111111111111111111111111',
      label: 'USDC',
      heldDays: 320,
      longestStreakDays: 320,
      stillHolding: true,
      isComplete: true
    },
    {
      chainId: 8453,
      address: '0x2222222222222222222222222222222222222222',
      label: 'WETH',
      heldDays: 180,
      longestStreakDays: 150,
      stillHolding: true,
      isComplete: true
    },
    {
      chainId: 1,
      address: '0x3333333333333333333333333333333333333333',
      label: 'DAI',
      heldDays: 90,
      longestStreakDays: 90,
      stillHolding: false,
      isComplete: true
    }
  ],
  activity: {
    deposits: 12,
    withdrawals: 3,
    transfers: 5,
    monthly: [2, 1, 4, 0, 3, 1, 2, 1, 3, 2, 1].map((count, month) => ({
      month: `2026-${String(month + 1).padStart(2, '0')}`,
      count
    })),
    hours: Array.from({ length: 24 }, (_, hour) => ([8, 14, 15, 20].includes(hour) ? 5 : 0))
  }
}
