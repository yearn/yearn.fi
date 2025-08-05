import {type DependencyList, useCallback, useEffect} from 'react'

//Should be useAsyncEffect, but exhaustive-deps is messing with this.
function useAsyncTrigger(effect: () => Promise<void>, deps: DependencyList): () => Promise<void> {
	// biome-ignore lint/correctness/useExhaustiveDependencies: effect is not valid dep here
	const asyncEffectInCallback = useCallback(async (): Promise<void> => {
		effect()
	}, [...deps])

	useEffect((): void => {
		asyncEffectInCallback()
	}, [asyncEffectInCallback])

	return asyncEffectInCallback
}

function useAsyncTriggerWithArgs(effect: (args?: unknown) => Promise<void>, deps: DependencyList): () => Promise<void> {
	// biome-ignore lint/correctness/useExhaustiveDependencies: effect is not valid dep here
	const asyncEffectInCallback = useCallback(
		async (...args: unknown[]): Promise<void> => {
			effect(...args)
		},
		[...deps]
	)

	useEffect((): void => {
		asyncEffectInCallback()
	}, [asyncEffectInCallback])

	return asyncEffectInCallback
}

export {useAsyncTrigger, useAsyncTriggerWithArgs}
