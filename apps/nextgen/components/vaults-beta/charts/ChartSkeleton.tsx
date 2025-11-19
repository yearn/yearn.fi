const PLACEHOLDER_ROWS = ['chart-row-a', 'chart-row-b', 'chart-row-c', 'chart-row-d', 'chart-row-e', 'chart-row-f']

export default function ChartSkeleton() {
  return (
    <div className={'rounded-xl border border-neutral-200 bg-neutral-0 p-6 animate-pulse space-y-4'}>
      <div className={'h-4 w-48 rounded bg-neutral-200'} />
      <div className={'h-3 w-64 rounded bg-neutral-100'} />
      <div className={'mt-6 space-y-2'}>
        {PLACEHOLDER_ROWS.map((rowKey) => (
          <div key={rowKey} className={'flex items-center gap-2'}>
            <div className={'h-2 w-2 rounded-full bg-neutral-200'} />
            <div className={'h-3 flex-1 rounded bg-neutral-100'} />
          </div>
        ))}
      </div>
    </div>
  )
}
