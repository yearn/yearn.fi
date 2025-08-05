/************************************************************************************************
 * Global SWR Configuration for enhanced caching across the application
 * Provides default settings for cache duration, retries, and error handling
 * Can be used with SWRConfig provider for application-wide defaults
 ************************************************************************************************/
import type { SWRConfiguration } from 'swr'

export const defaultSWRConfig: SWRConfiguration = {
	// Cache configuration
	dedupingInterval: 2 * 60 * 1000, // 2 minutes
	revalidateOnFocus: false,
	revalidateIfStale: true,
	revalidateOnMount: true,
	revalidateOnReconnect: true,

	// Background revalidation
	refreshWhenHidden: false,
	refreshWhenOffline: false,

	// Error handling and retries
	shouldRetryOnError: true,
	errorRetryCount: 3,
	errorRetryInterval: 1000, // 1 second

	// Performance optimizations
	keepPreviousData: true,
	compare: (a, b) => {
		// Custom comparison to prevent unnecessary re-renders
		return JSON.stringify(a) === JSON.stringify(b)
	},

	// Loading delay for better UX
	loadingTimeout: 3000
}
