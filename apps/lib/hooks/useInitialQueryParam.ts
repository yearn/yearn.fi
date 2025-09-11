import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/************************************************************************************************
 ** useInitialQueryParam Hook
 **
 ** This custom hook is designed to retrieve and manage the initial query parameter from the URL.
 ** It handles both client-side and server-side rendering scenarios, ensuring that the query
 ** parameter is correctly retrieved regardless of the rendering context.
 **
 ** The hook performs the following tasks:
 ** 1. On the client-side, it initially checks the URL for the query parameter.
 ** 2. Once the router is ready, it updates the value based on the router's query object.
 ** 3. It returns the current value of the query parameter, which can be used in the component.
 **
 ** @param {string} key - The name of the query parameter to retrieve
 ** @returns {string | null} - The value of the query parameter, or null if not found
 ************************************************************************************************/
export function useInitialQueryParam(key: string): string | null {
  const location = useLocation()
  const [value, setValue] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const initialValue = urlParams.get(key)
      setValue(initialValue)
    }
  }, [key])

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const queryValue = searchParams.get(key)
    if (queryValue && queryValue !== value) {
      setValue(queryValue)
    }
  }, [location.search, key, value])

  return value
}
