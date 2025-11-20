import { useThemePreference } from '@hooks/useThemePreference'
import type { ReactElement } from 'react'
import { Cell, Label, Pie, PieChart, Tooltip } from 'recharts'
import { AllocationTooltip } from './AllocationTooltip'

const LIGHT_MODE_COLORS = ['#0657f9', '#3d7bfa', '#5c93fb', '#7aabfc', '#99c3fd', '#b8dbfe']
const DARK_MODE_COLORS = ['#ff6ba5', '#ffb3d1', '#ff8fbb', '#ffd6e7', '#d21162', '#ff4d94']

export type TAllocationChartData = {
  id: string
  name: string
  value: number
  amount: string
}

type TAllocationChartProps = {
  allocationChartData: TAllocationChartData[]
  colors?: string[]
  textColor?: string
  strokeColor?: string
  fillColor?: string
  width?: number
  height?: number
  innerRadius?: number
  outerRadius?: number
  paddingAngle?: number
  startAngle?: number
  endAngle?: number
  minAngle?: number
  labelText?: string
}

/************************************************************************************************
 * Generic pie chart component for displaying allocation data
 * Supports both hex colors and Tailwind classes through the colors prop
 * All dimensions and styling are configurable through props
 ************************************************************************************************/
function useDarkMode(): boolean {
  const themePreference = useThemePreference()
  return themePreference === 'dark'
}

export function AllocationChart({
  allocationChartData,
  colors,
  textColor = 'bg-neutral-900',
  strokeColor,
  fillColor = 'white',
  width = 150,
  height = 150,
  innerRadius = 50,
  outerRadius = 75,
  paddingAngle = 5,
  startAngle = 90,
  endAngle = -270,
  minAngle = 3,
  labelText = 'allocation %'
}: TAllocationChartProps): ReactElement {
  const isDark = useDarkMode()
  const chartColors = colors || (isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS)
  const chartStroke = strokeColor || (isDark ? '#ff6ba5' : '#0657f9')
  return (
    <PieChart width={width} height={height}>
      <Pie
        data={allocationChartData}
        dataKey={'value'}
        nameKey={'name'}
        cx={'50%'}
        cy={'50%'}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={paddingAngle}
        fill={fillColor}
        stroke={chartStroke}
        startAngle={startAngle}
        minAngle={minAngle}
        endAngle={endAngle}
      >
        {allocationChartData.map(({ id }, index) => (
          <Cell key={id} fill={chartColors[index % chartColors.length]} />
        ))}
        <Label
          content={() => (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor={'middle'}
              dominantBaseline={'middle'}
              className={`${textColor} text-sm font-medium`}
            >
              {labelText}
            </text>
          )}
        />
      </Pie>
      <Tooltip
        position={{ y: -80 }}
        content={({ active, payload }) => <AllocationTooltip active={active || false} payload={payload} />}
      />
    </PieChart>
  )
}

export { LIGHT_MODE_COLORS, DARK_MODE_COLORS, useDarkMode }
