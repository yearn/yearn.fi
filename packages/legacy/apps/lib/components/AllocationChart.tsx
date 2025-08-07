import type { ReactElement } from 'react'
import { Cell, Label, Pie, PieChart, Tooltip } from 'recharts'
import { AllocationTooltip } from './AllocationTooltip'

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
export function AllocationChart({
  allocationChartData,
  colors = ['#ff6ba5', '#ffb3d1', '#ff8fbb', '#ffd6e7', '#d21162', '#ff4d94'],
  textColor = 'fill-white',
  strokeColor = 'hsl(231, 100%, 11%)',
  fillColor = 'white',
  width = 200,
  height = 200,
  innerRadius = 80,
  outerRadius = 100,
  paddingAngle = 5,
  startAngle = 90,
  endAngle = -270,
  minAngle = 3,
  labelText = 'allocation %'
}: TAllocationChartProps): ReactElement {
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
        stroke={strokeColor}
        startAngle={startAngle}
        minAngle={minAngle}
        endAngle={endAngle}>
        {allocationChartData.map(({ id }, index) => (
          <Cell
            key={id}
            fill={colors[index % colors.length]}
            className={colors[index % colors.length]}
          />
        ))}
        <Label
          content={() => (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor={'middle'}
              dominantBaseline={'middle'}
              className={`${textColor} text-sm font-medium`}>
              {labelText}
            </text>
          )}
        />
      </Pie>
      <Tooltip
        content={({ active, payload }) => (
          <AllocationTooltip active={active || false} payload={payload} />
        )}
      />
    </PieChart>
  )
}
