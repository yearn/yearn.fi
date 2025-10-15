import { type ComponentType, type LazyExoticComponent, lazy } from 'react'

type Loader<TComponent extends ComponentType<any>> = () => Promise<{ default: TComponent }>

const SHOULD_BUST_CHUNK_CACHE =
  /(Failed to fetch dynamically imported module|Failed to load module script|Importing a module script failed|mime type)/i
const SESSION_STORAGE_RETRY_KEY = 'yearn-lazy-import-retried'

export function lazyWithRetry<TComponent extends ComponentType<any>>(
  loader: Loader<TComponent>
): LazyExoticComponent<TComponent> {
  return lazy(async () => {
    try {
      const module = await loader()
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(SESSION_STORAGE_RETRY_KEY)
      }
      return module
    } catch (error) {
      if (typeof window !== 'undefined') {
        const alreadyRetried = window.sessionStorage.getItem(SESSION_STORAGE_RETRY_KEY) === 'true'
        const message = error instanceof Error ? error.message : String(error)

        if (!alreadyRetried && SHOULD_BUST_CHUNK_CACHE.test(message)) {
          window.sessionStorage.setItem(SESSION_STORAGE_RETRY_KEY, 'true')
          window.location.reload()
        } else {
          window.sessionStorage.removeItem(SESSION_STORAGE_RETRY_KEY)
        }
      }

      throw error
    }
  })
}
