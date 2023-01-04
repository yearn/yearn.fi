import {useCallback, useEffect, useRef, useState} from 'react';

function	useAsync<T>(
	callback: (...args: unknown[]) => Promise<T>,
	defaultValue?: T,
	effectDependencies: unknown[] = []
): [T | undefined, () => Promise<void>] {
	const runNonce = useRef(0);
	const isLoading = useRef(false);
	const [data, set_data] = useState(defaultValue);

	const callCallback = useCallback(async (): Promise<void> => {
		isLoading.current = true;
		const	currentNonce = runNonce.current;
		try {
			const	res = await callback();
			if (currentNonce === runNonce.current) {
				isLoading.current = false;
				set_data(res);
			}
		} catch(e) {
			//
		}
	}, [callback]);

	useEffect((): void => {
		runNonce.current += 1;
		callCallback();
	}, [callCallback, ...effectDependencies]);

	return ([isLoading.current ? defaultValue : (data || defaultValue), callCallback]);	
}

export {useAsync};
