const PLACEHOLDER_ROWS = ['chart-row-a', 'chart-row-b', 'chart-row-c', 'chart-row-d', 'chart-row-e', 'chart-row-f']

export default function ChartSkeleton() {
  return (
    <div className={'rounded-xl border border-border bg-surface p-6 animate-pulse space-y-4'}>
      <div className={'h-4 w-48 rounded bg-surface-secondary'} />
      <div className={'h-3 w-64 rounded bg-surface-secondary'} />
      <div className={'mt-6 space-y-2'}>
        {PLACEHOLDER_ROWS.map((rowKey) => (
          <div key={rowKey} className={'flex items-center gap-2'}>
            <div className={'h-2 w-2 rounded-full bg-surface-secondary'} />
            <div className={'h-3 flex-1 rounded bg-surface-secondary'} />
          </div>
        ))}
      </div>
    </div>
  )
}
