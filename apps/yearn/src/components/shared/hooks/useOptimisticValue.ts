import { type Dispatch, type SetStateAction, useState } from 'react'

/**
 * Manages optimistic state that overrides the actual value until actual catches up.
 *
 * Replaces the useState + useEffect pattern for clearing optimistic overrides:
 *   const [optimistic, setOptimistic] = useState(null)
 *   useEffect(() => { if (optimistic !== null && optimistic === actual) setOptimistic(null) }, [optimistic, actual])
 *   const displayed = optimistic ?? actual
 *
 * Instead: const [displayed, setOptimistic] = useOptimisticValue(actual)
 *
 * Uses render-time state adjustment (React-approved) instead of useEffect.
 */
export function useOptimisticValue<T>(
  actual: T,
  isEqual: (a: T, b: T) => boolean = Object.is
): [displayed: T, setOptimistic: Dispatch<SetStateAction<T | null>>] {
  const [optimistic, setOptimistic] = useState<T | null>(null)

  // Clear optimistic when actual catches up — render-time adjustment avoids useEffect
  if (optimistic !== null && isEqual(optimistic, actual)) {
    setOptimistic(null)
  }

  return [optimistic ?? actual, setOptimistic]
}
