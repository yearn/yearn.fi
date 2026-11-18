import type { TWrapped } from '@yearn/wrapped-contract'

export type TCard = {
  id: string
  title: string
  value: string
  line: string
  note: string
  facts: Array<{ label: string; value: string }>
  chart?: Array<{ label: string; value: number | null }>
  chartKind?: 'line' | 'bars'
}
const number = (value: number): string => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)
const signed = (value: number): string => `${value > 0 ? '+' : ''}${number(value)}%`
export const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`
const prettyDate = (date: string): string =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(date)
  )

export function buildCards(payload: TWrapped, name?: string, isDemo = false): TCard[] {
  const longest = payload.vaults
    .filter((vault) => vault.isComplete)
    .toSorted((a, b) => b.longestStreakDays - a.longestStreakDays)[0]
  const home = payload.vaults.every((vault) => vault.isComplete) ? payload.vaults[0] : undefined
  const period = `${prettyDate(payload.period.start)} – ${prettyDate(payload.period.end)}`
  const totalEvents = payload.activity.monthly.reduce((sum, month) => sum + month.count, 0)
  const busiest = payload.activity.monthly.toSorted((a, b) => b.count - a.count)[0]
  const common = { facts: [] as TCard['facts'], note: '' }
  return [
    {
      ...common,
      id: 'identity',
      title: 'Your year in yVaults',
      value: `Hello ${name || 'Anon'}`,
      line: `${isDemo ? 'Fictional demo. ' : ''}Every position has a story. Here’s yours.`,
      note: ''
    },
    ...(payload.firstActivity !== null
      ? [
          {
            ...common,
            id: 'first',
            title: 'The first chapter',
            value: new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
              new Date(payload.firstActivity * 1000)
            ),
            line: 'Your first indexed Yearn activity.',
            note: 'Within the available indexer history. Other wallets are not included.'
          }
        ]
      : []),
    {
      ...common,
      id: 'vaults',
      title: 'Vaults explored',
      value: String(payload.vaults.length),
      line: payload.vaults.length === 1 ? 'You found your place.' : 'A little exploration. A lot of possibility.',
      facts: [
        { value: String(payload.vaults.filter((vault) => vault.stillHolding).length), label: 'still holding' },
        { value: String(payload.coverage.chains.length), label: 'chains' }
      ],
      note: 'Vault families held during the recap period. Includes positions opened before 2026.'
    },
    {
      ...common,
      id: 'chains',
      title: 'Your onchain map',
      value: String(payload.coverage.chains.length),
      line: payload.coverage.chains.map((chain) => chain.name).join(' · ') || 'No positive positions in this period.',
      note: 'Uses the same supported networks and hidden-vault rules as Yearn Portfolio.'
    },
    ...(home
      ? [
          {
            ...common,
            id: 'home',
            title: 'Your home base',
            value: home.label,
            line: `${number(home.heldDays)} days with shares in this vault.`,
            note: 'Ranked by time held during 2026, not dollars invested. Simultaneous holdings each accrue time.'
          }
        ]
      : []),
    {
      ...common,
      id: 'ledger',
      title: 'You made moves',
      value: String(payload.activity.deposits),
      line: 'Deposits into Yearn vaults.',
      facts: [
        { value: String(payload.activity.withdrawals), label: 'withdrawals' },
        { value: String(payload.activity.transfers), label: 'share transfers' }
      ],
      note: 'Indexed events, not unique transactions. Direct staking deposits and withdrawals are excluded from these flow counts.'
    },
    {
      ...common,
      id: 'return',
      title: 'Your vault return',
      value: payload.return.pct === null ? 'Still a story.' : signed(payload.return.pct),
      line: payload.return.pct === null ? 'Your return needs more data.' : 'Your calendar-year Growth Index return.',
      note:
        payload.return.pct === null
          ? 'Incomplete pricing or index coverage. Missing data is not zero return.'
          : `Estimated protocol performance using Yearn Portfolio’s Growth Index. Baseline: ${payload.return.baselineDate}. Through ${payload.period.end}. Not personal profit or USD earnings.`,
      chart: payload.return.points.map((point) => ({ label: point.date, value: point.value })),
      chartKind: 'line' as const
    },
    ...(longest
      ? [
          {
            ...common,
            id: 'streak',
            title: 'You stayed the course',
            value: `${number(longest.longestStreakDays)} days`,
            line: `Your longest uninterrupted hold: ${longest.label}.`,
            note: 'Positive share balance in one vault family, bounded to the recap year.'
          }
        ]
      : []),
    {
      ...common,
      id: 'rhythm',
      title: 'The shape of your year',
      value: busiest?.count
        ? new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(`${busiest.month}-01`))
        : 'Quietly holding.',
      line: busiest?.count
        ? `${busiest.count} indexed events in your busiest month.`
        : 'No new indexed activity. Existing positions still count.',
      chart: payload.activity.monthly.map((month) => ({ label: month.month, value: month.count })),
      chartKind: 'bars' as const,
      note: 'UTC months. No activity is not the same as no holdings.'
    },
    ...(totalEvents > 0
      ? [
          {
            ...common,
            id: 'hours',
            title: 'Your farming hours',
            value: `${String(payload.activity.hours.indexOf(Math.max(...payload.activity.hours))).padStart(2, '0')}:00`,
            line: 'Your busiest hour, in UTC.',
            chart: payload.activity.hours.map((value, hour) => ({ label: `${hour}:00`, value })),
            chartKind: 'bars' as const,
            note: 'Indexed deposits, withdrawals and share transfers. Tied hours use the earliest UTC hour.'
          }
        ]
      : []),
    {
      ...common,
      id: 'summary',
      title: 'Your 2026, wrapped',
      value: payload.return.pct === null ? `${payload.vaults.length} vaults. Your story.` : signed(payload.return.pct),
      line:
        payload.return.pct === null
          ? 'A year measured in more than returns.'
          : 'Estimated vault return. A year made yours.',
      facts: [
        { value: String(payload.vaults.length), label: 'vaults held' },
        { value: String(payload.activity.deposits), label: 'deposits' },
        { value: longest ? number(longest.longestStreakDays) : '—', label: 'longest hold · days' }
      ],
      note: `${period}${payload.period.partial ? ' · Year to date' : ''}. ${payload.coverage.isComplete ? 'Built with Yearn Portfolio data.' : 'Some data is incomplete.'} Percentage is Growth Index performance, not USD earnings.`
    }
  ]
}
