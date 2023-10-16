import {useCallback, useEffect} from 'react';

import type {DependencyList} from 'react';

function useAsyncEffect(effect: () => Promise<void>, deps?: DependencyList): () => Promise<void> {
	const asyncEffectInCallback = useCallback(async (): Promise<void> => {
		effect();
	}, [effect, deps]);

	useEffect((): void => {
		asyncEffectInCallback();
	}, [asyncEffectInCallback]);

	return asyncEffectInCallback;
}

export {useAsyncEffect};
