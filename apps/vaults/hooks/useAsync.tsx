import {useCallback, useEffect, useRef, useState} from 'react';

function	useAsync<T>(
	callback: (...args: unknown[]) => Promise<T>,
	defaultValue: T,
	effectDependencies?: unknown[]
): T {
	const runNonce = useRef(0);
	const [data, set_data] = useState(defaultValue);
	const callCallback = useCallback(async (): Promise<void> => {
		const	currentNonce = runNonce.current;
		try {
			const	res = await callback();
			if (currentNonce === runNonce.current) {
				set_data(res);
			}
		} catch(e) {
			//
		}
	}, [callback]);

	useEffect((): void => {
		runNonce.current += 1;
		callCallback();
	}, [callCallback, effectDependencies]);

	return (data || defaultValue);	
}

export {useAsync};
