import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * @deprecated Use `@react-hookz/web` instead
 */
export function useAsync<T>(
	callback: (...args: unknown[]) => Promise<T | undefined>,
	defaultValue?: T,
	effectDependencies: unknown[] = []
): [T | undefined, boolean, () => Promise<void>] {
	const runNonce = useRef(0);
	const [isLoading, set_isLoading] = useState(false);
	const [data, set_data] = useState(defaultValue);

	const callCallback = useCallback(async (): Promise<void> => {
		set_isLoading(true);
		const currentNonce = runNonce.current;
		try {
			const res = await callback();
			if (currentNonce === runNonce.current) {
				set_isLoading(false);
				set_data(res);
			}
		} catch {
			set_isLoading(false);
		}
	}, [callback]);

	useEffect((): void => {
		runNonce.current += 1;
		callCallback();
	}, [callCallback, ...effectDependencies]);

	return [isLoading ? defaultValue : data || defaultValue, isLoading, callCallback];
}
