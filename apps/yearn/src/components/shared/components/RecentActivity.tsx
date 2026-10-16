import { useThemePreference } from '@hooks/useThemePreference'
import { useNotifications } from '@shared/contexts/useNotifications'
import { IconArrowRight } from '@shared/icons/IconArrowRight'
import { IconLoader } from '@shared/icons/IconLoader'
import { LogoYearn } from '@shared/icons/LogoYearn'
import { cl } from '@shared/utils'
import { getNotificationLifecyclePresentation } from '@shared/utils/notificationLifecycle'
import type { ReactElement } from 'react'

export function RecentActivity({ onViewAll }: { onViewAll: () => void }): ReactElement {
  const { cachedEntries } = useNotifications()
  const isDarkTheme = useThemePreference() !== 'light'
  const isPending = (status: string): boolean => status === 'pending' || status === 'submitted'
  const pendingCount = cachedEntries.filter((entry) => isPending(entry.status)).length
  const recent = cachedEntries
    .toSorted(
      (a, b) =>
        Number(isPending(b.status)) - Number(isPending(a.status)) ||
        (b.timeFinished ?? b.createdAt ?? 0) - (a.timeFinished ?? a.createdAt ?? 0)
    )
    .slice(0, Math.max(3, pendingCount))

  return (
    <div className="mt-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Recent activity</h3>
      {recent.length ? (
        <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto">
          {recent.map((activity) => {
            const pending = isPending(activity.status)
            const presentation = getNotificationLifecyclePresentation(activity)
            const timestamp = activity.timeFinished ?? activity.createdAt
            return (
              <li key={activity.lifecycleRecord?.id ?? activity.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cl(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      isDarkTheme ? 'bg-surface-secondary' : 'bg-neutral-100'
                    )}
                  >
                    {pending ? (
                      <span role="status" aria-label={presentation.label}>
                        <IconLoader className="size-5 animate-spin text-primary motion-reduce:animate-none" />
                      </span>
                    ) : (
                      <LogoYearn className="size-5" front="text-white" back="text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cl(
                        'text-sm font-medium capitalize',
                        activity.status === 'error'
                          ? 'text-red'
                          : activity.status === 'success'
                            ? 'text-[#0C9000]'
                            : 'text-primary'
                      )}
                    >
                      {activity.type}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {activity.amount} {activity.fromTokenName ?? ''}
                    </p>
                    <p className="text-xs text-text-secondary">{presentation.label}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-text-secondary">
                  {timestamp
                    ? new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : ''}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">No recent activity</p>
      )}
      {recent.length > 0 && (
        <button
          onClick={onViewAll}
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          View all activity <IconArrowRight className="size-4" />
        </button>
      )}
    </div>
  )
}
