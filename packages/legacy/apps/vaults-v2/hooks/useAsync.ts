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
	const [isLoading, setIsLoading] = useState(false);
	const [data, setData] = useState(defaultValue);

	const callCallback = useCallback(async (): Promise<void> => {
		setIsLoading(true);
		const currentNonce = runNonce.current;
		try {
			const res = await callback();
			if (currentNonce === runNonce.current) {
				setIsLoading(false);
				setData(res);
			}
		} catch {
			setIsLoading(false);
		}
	}, [callback]);

	useEffect((): void => {
		runNonce.current += 1;
		callCallback();
	}, [callCallback, ...effectDependencies]);

	return [isLoading ? defaultValue : data || defaultValue, isLoading, callCallback];
}
