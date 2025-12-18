import { useLocalStorage } from '@lib/hooks/useLocalStorage'
import type { TChartStyle } from '@lib/utils/chartStyles'
import { CHART_STYLE_OPTIONS } from '@lib/utils/chartStyles'
import type { ReactElement } from 'react'
import { createContext, useContext, useMemo } from 'react'

const STORAGE_KEY = 'yearn-chart-style'

type ChartStyleContextValue = {
  chartStyle: TChartStyle
  setChartStyle: (style: TChartStyle) => void
}

const ChartStyleContext = createContext<ChartStyleContextValue>({
  chartStyle: 'blended',
  setChartStyle: () => undefined
})

export function ChartStyleContextApp({ children }: { children: ReactElement }): ReactElement {
  const [chartStyle, setChartStyle] = useLocalStorage<TChartStyle>(STORAGE_KEY, 'blended')

  const value = useMemo<ChartStyleContextValue>(() => {
    return { chartStyle, setChartStyle }
  }, [chartStyle, setChartStyle])

  return <ChartStyleContext.Provider value={value}>{children}</ChartStyleContext.Provider>
}

export function useChartStyle(): ChartStyleContextValue {
  return useContext(ChartStyleContext)
}

export { CHART_STYLE_OPTIONS }
