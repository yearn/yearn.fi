import { scoreColor, scoreTextColor, scoreTier } from '@pages/curation/lib/colors'
import type { TCategoryScore } from '@pages/curation/lib/parseReport'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'

type TTooltipData = {
  category: string
  weight: string
  score: number
  x: number
  y: number
}

type TPieSegment = TCategoryScore & {
  startAngle: number
  endAngle: number
  color: string
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  }
}

function buildArcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const startPoint = polarToCartesian(cx, cy, radius, start)
  const endPoint = polarToCartesian(cx, cy, radius, end)
  const isLargeArc = end - start > 180 ? 1 : 0

  return `M ${cx} ${cy} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${isLargeArc} 1 ${endPoint.x} ${endPoint.y} Z`
}

function getLabelPosition(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number
): { x: number; y: number } {
  const midAngle = (start + end) / 2
  return polarToCartesian(cx, cy, radius * 0.65, midAngle)
}

type TScoreTableProps = {
  scores: TCategoryScore[]
  finalScore: number
}

export function ScoreTable({ scores, finalScore }: TScoreTableProps): ReactElement {
  const [tooltip, setTooltip] = useState<TTooltipData | undefined>(undefined)

  const totalWeight = useMemo(() => {
    return scores.reduce((sum, score) => sum + (Number.parseFloat(score.weight) || 0), 0)
  }, [scores])

  const segments = useMemo((): TPieSegment[] => {
    if (scores.length === 0 || totalWeight <= 0) {
      return []
    }

    return scores.reduce<{ accumulated: number; segments: TPieSegment[] }>(
      (state, score) => {
        const weight = Number.parseFloat(score.weight) || 0
        const startAngle = (state.accumulated / totalWeight) * 360
        const nextAccumulated = state.accumulated + weight
        const endAngle = (nextAccumulated / totalWeight) * 360

        return {
          accumulated: nextAccumulated,
          segments: [
            ...state.segments,
            {
              ...score,
              startAngle,
              endAngle,
              color: scoreColor(score.score)
            }
          ]
        }
      },
      { accumulated: 0, segments: [] }
    ).segments
  }, [scores, totalWeight])

  if (scores.length === 0) {
    return <p className={'text-text-secondary'}>{'No score breakdown is available for this report yet.'}</p>
  }

  return (
    <div className={'curation-score-section'}>
      <div className={'curation-table-wrap curation-score-table-area'}>
        <table className={'curation-table'}>
          <thead>
            <tr>
              <th>{'Category'}</th>
              <th>{'Weight'}</th>
              <th>{'Score'}</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score) => (
              <tr key={score.category}>
                <td>
                  <span className={'curation-score-dot'} style={{ background: scoreColor(score.score) }} />
                  {score.category}
                </td>
                <td>{score.weight}</td>
                <td style={{ color: scoreColor(score.score) }}>{score.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <strong>{'Final Score'}</strong>
              </td>
              <td style={{ color: scoreColor(finalScore), fontWeight: 700 }}>{`${finalScore.toFixed(1)} / 5.0`}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={'curation-chart-area'}>
        <div className={'curation-chart-container'}>
          <svg viewBox={'0 0 200 200'} className={'curation-pie-chart'} role={'img'} aria-label={'Risk score chart'}>
            {segments.map((segment) => (
              <path
                key={segment.category}
                d={buildArcPath(100, 100, 90, segment.startAngle, segment.endAngle)}
                fill={segment.color}
                stroke={'var(--color-app)'}
                strokeWidth={2}
                className={'curation-pie-segment'}
                onMouseEnter={(event) => {
                  const chartBounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
                  if (!chartBounds) {
                    return
                  }

                  setTooltip({
                    category: segment.category,
                    weight: segment.weight,
                    score: segment.score,
                    x: event.clientX - chartBounds.left + 12,
                    y: event.clientY - chartBounds.top - 10
                  })
                }}
                onMouseMove={(event) => {
                  const chartBounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
                  if (!chartBounds) {
                    return
                  }

                  setTooltip({
                    category: segment.category,
                    weight: segment.weight,
                    score: segment.score,
                    x: event.clientX - chartBounds.left + 12,
                    y: event.clientY - chartBounds.top - 10
                  })
                }}
                onMouseLeave={() => setTooltip(undefined)}
              />
            ))}
            {segments.map((segment) => {
              const labelWeight = Number.parseFloat(segment.weight)
              if (labelWeight < 10) {
                return null
              }

              const labelPosition = getLabelPosition(100, 100, 90, segment.startAngle, segment.endAngle)
              return (
                <text
                  key={`${segment.category}-label`}
                  x={labelPosition.x}
                  y={labelPosition.y}
                  textAnchor={'middle'}
                  dominantBaseline={'central'}
                  fill={scoreTextColor(segment.score)}
                  fontSize={11}
                  fontWeight={600}
                  className={'curation-pie-label'}
                >
                  {segment.weight}
                </text>
              )
            })}
          </svg>

          {tooltip && (
            <div className={'curation-chart-tooltip visible'} style={{ left: tooltip.x, top: tooltip.y }}>
              <strong>{tooltip.category}</strong>
              <br />
              {`Weight: ${tooltip.weight}`}
              <br />
              {`Score: ${tooltip.score.toFixed(2)}`}
            </div>
          )}
        </div>

        <div
          className={'curation-risk-tier-badge'}
          style={{ background: scoreColor(finalScore), color: scoreTextColor(finalScore) }}
        >
          {scoreTier(finalScore)}
        </div>
      </div>
    </div>
  )
}
