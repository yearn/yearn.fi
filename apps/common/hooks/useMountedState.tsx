//Credits: https://github.com/streamich/react-use/blob/master/src/useMountedState.ts
import {useCallback, useEffect, useRef} from 'react';

export default function useMountedState(): () => boolean {
	const mountedRef = useRef<boolean>(false);
	const isMounted = useCallback((): boolean => mountedRef.current, []);

	useEffect((): VoidFunction => {
		mountedRef.current = true;

		return (): void => {
			mountedRef.current = false;
		};
	}, []);

	return isMounted;
}