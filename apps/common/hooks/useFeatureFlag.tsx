import {useSearchParams} from 'next/navigation';

/**
 * Determines if a specific feature flag is enabled based on the URL's search parameters.
 *
 * @function
 * @name useFeatureFlag
 * @param {string} flag - The name of the feature flag to check for.
 * @returns {[boolean]} A boolean value inside an array indicating if the provided feature flag is enabled (`true` if enabled, `false` otherwise).
 * 
 * @example
 * const [isFeatureEnabled] = useFeatureFlag('newFeature');
 * if (isFeatureEnabled) {
 *    // render or implement the new feature
 * }
 */
export function useFeatureFlag(flag: string): [boolean] {
	const searchParams = useSearchParams();

	const flags = searchParams.get('features')?.split(',') ?? [];

	const isEnabled = flags.includes(flag);

	return [isEnabled];
}
