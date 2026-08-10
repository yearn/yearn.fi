import { useMemo, useState } from 'react'

type TPriceImpactAcceptance = {
  hasAcceptedPriceImpact: boolean
  setAcceptedPriceImpactKey: (key: string | null) => void
  priceImpactAcceptanceKey: string
}

export function usePriceImpactAcceptance(
  routeKeyParts: (string | number | bigint | undefined | null)[]
): TPriceImpactAcceptance {
  const [acceptedPriceImpactKey, setAcceptedPriceImpactKey] = useState<string | null>(null)

  // The array parameter IS the useMemo deps — React iterates its elements and
  // compares each with Object.is. This works because callers pass inline array
  // literals whose elements are primitive (string | number | bigint).
  const priceImpactAcceptanceKey = useMemo(
    () => routeKeyParts.map((part) => String(part ?? '')).join(':'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    routeKeyParts
  )

  const hasAcceptedPriceImpact = acceptedPriceImpactKey === priceImpactAcceptanceKey

  return {
    hasAcceptedPriceImpact,
    setAcceptedPriceImpactKey,
    priceImpactAcceptanceKey
  }
}
