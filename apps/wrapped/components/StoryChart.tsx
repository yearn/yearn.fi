import { chartGeometry, type TChartPoint } from '@wrapped/lib/chart'

export function StoryChart({ points, kind }: { points: TChartPoint[]; kind: 'bars' | 'line' }) {
  if (!points.some((point) => point.value !== null)) return null
  const geometry = chartGeometry(points)
  return (
    <figure className="story-chart">
      <svg
        viewBox="0 0 800 180"
        role="img"
        aria-label={
          kind === 'line' ? 'Growth Index during the recap period' : 'Activity counts, linear scale from zero'
        }
      >
        {kind === 'line' ? (
          <path d={geometry.line} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        ) : (
          geometry.bars.map((bar, index) => (
            <rect
              key={points[index]!.label}
              x={bar.x}
              y={160 - bar.height}
              width={bar.width}
              height={bar.height}
              fill="currentColor"
              rx="2"
            />
          ))
        )}
      </svg>
      <figcaption>
        <span>{geometry.first}</span>
        <span>
          {kind === 'line' ? `Index · ${geometry.min.toFixed(1)}–${geometry.max.toFixed(1)}` : 'Indexed events · UTC'}
        </span>
        <span>{geometry.last}</span>
      </figcaption>
      <details>
        <summary>View chart data</summary>
        <div className="chart-table">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>{kind === 'line' ? 'Growth Index' : 'Events'}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.label}>
                  <td>{point.label}</td>
                  <td>{point.value?.toFixed(kind === 'line' ? 2 : 0) ?? 'Unavailable'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
