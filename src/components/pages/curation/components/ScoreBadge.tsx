import { scoreColor, scoreTextColor } from '@pages/curation/lib/colors'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

type TScoreBadgeProps = {
  score: number
  size?: 'small' | 'large'
}

export function ScoreBadge({ score, size = 'small' }: TScoreBadgeProps): ReactElement {
  const color = scoreColor(score)
  const textColor = scoreTextColor(score)

  return (
    <span
      className={cl(
        'inline-block whitespace-nowrap rounded-md font-bold tabular-nums',
        size === 'large' ? 'px-3 py-1.5 text-xl' : 'px-2 py-0.5 text-sm'
      )}
      style={{ background: color, color: textColor }}
    >
      {score.toFixed(1)}
    </span>
  )
}
