export type TChartPoint = { label: string; value: number | null }

export function chartGeometry(points: TChartPoint[], width = 800, height = 160) {
  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]))
  const low = Math.min(...values, 0)
  const high = Math.max(...values, 1)
  // Lines use their actual value range; bars have a zero baseline.
  const min = Math.min(...values)
  const max = Math.max(...values)
  const lineLow = Number.isFinite(min) ? min : 0
  const range = max - lineLow || 1
  return {
    line: points
      .map((point, index) =>
        point.value === null
          ? ''
          : `${index === 0 ? 'M' : 'L'}${(index * width) / Math.max(1, points.length - 1)},${height - ((point.value - lineLow) / range) * height}`
      )
      .join(' '),
    bars: points.map((point, index) => ({
      x: (index * width) / points.length,
      width: Math.max(1, width / points.length - 5),
      height: point.value === null ? 0 : ((point.value - low) / (high - low)) * height
    })),
    first: points[0]?.label,
    last: points.at(-1)?.label,
    min: lineLow,
    max: Number.isFinite(max) ? max : 1
  }
}
