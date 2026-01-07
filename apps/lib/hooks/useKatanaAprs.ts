import { useEffect, useState } from 'react'

const CACHE_KEY = 'katana-aprs-cache'
const CACHE_TTL = 15 * 60 * 1000 // 15 min

export type TKatanaAprs = {
  [key: string]: {
    apr: {
      netAPR: number
      extra: TKatanaAprData
    }
  }
}

export type TKatanaAprData = {
  katanaRewardsAPR: number // legacy field for App rewards from Morpho, Sushi, Yearn, etc.
  katanaAppRewardsAPR: number // rewards from Morpho, Sushi, Yearn, etc.
  FixedRateKatanaRewards: number // fixed rate rewards from Katana
  katanaBonusAPY: number // bonus APR from Katana for not leaving the vault
  katanaNativeYield: number // yield from katana markets (the netAPR). This is subsidized if low.
  steerPointsPerDollar?: number // points per dollar from APR oracle (metadata, not part of APR sum).
}

type TCacheData = {
  data: TKatanaAprs
  timestamp: number
}

export const useKatanaAprs = (): { data: Partial<TKatanaAprs>; isLoading: boolean; error: Error | null } => {
  const [data, set_data] = useState<Partial<TKatanaAprs>>({})
  const [isLoading, set_isLoading] = useState(true)
  const [error, set_error] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        // Check cache first
        const cachedString = localStorage.getItem(CACHE_KEY)
        if (cachedString) {
          const cached: TCacheData = JSON.parse(cachedString)
          const now = Date.now()

          // Return cached data if within TTL
          if (now - cached.timestamp < CACHE_TTL) {
            set_data(cached.data)
            set_isLoading(false)
            return
          }
        }

        const apiUrl = import.meta.env.VITE_KATANA_APR_SERVICE_API
        if (!apiUrl) {
          throw new Error('KATANA_APR_SERVICE_API environment variable is not set')
        }

        const freshData = await fetch(apiUrl).then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error: ${res.status}`)
          }
          return res.json()
        })

        const cacheData: TCacheData = {
          data: freshData,
          timestamp: Date.now()
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))

        set_data(freshData)
        set_error(null)
      } catch (err) {
        set_error(err as Error)
        const cachedString = localStorage.getItem(CACHE_KEY)
        if (cachedString) {
          const cached: TCacheData = JSON.parse(cachedString)
          set_data(cached.data)
        }
      } finally {
        set_isLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, isLoading, error }
}
