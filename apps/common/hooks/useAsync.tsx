//Credits: https://github.com/streamich/react-use/blob/master/src/useAsyncFn.ts
import {useCallback, useEffect, useRef, useState} from 'react';
import useMountedState from '@common/hooks/useMountedState';

import type {DependencyList} from 'react';

type TPromiseType<TPromise extends Promise<any>> = TPromise extends Promise<infer T> ? T : never;
type TFunctionReturningPromise = (...args: any[]) => Promise<any>;
type TAsyncState<T> =
	| {
		loading: boolean;
		error?: undefined;
		value?: undefined;
		}
	| {
		loading: true;
		error?: Error | undefined;
		value?: T;
		}
	| {
		loading: false;
		error: Error;
		value?: undefined;
		}
	| {
		loading: false;
		error?: undefined;
		value: T;
	};

type TStateFromFunctionReturningPromise<T extends TFunctionReturningPromise> = TAsyncState<TPromiseType<ReturnType<T>>>;
type TAsyncFnReturn<T extends TFunctionReturningPromise = TFunctionReturningPromise> = [
	TStateFromFunctionReturningPromise<T>,
	T
];

export function useAsyncFn<T extends TFunctionReturningPromise>(
	fn: T,
	deps: DependencyList = [],
	initialState: TStateFromFunctionReturningPromise<T> = {loading: false}
): TAsyncFnReturn<T> {
	const lastCallId = useRef(0);
	const isMounted = useMountedState();
	const [state, set_state] = useState<TStateFromFunctionReturningPromise<T>>(initialState);

	const callback = useCallback((...args: Parameters<T>): ReturnType<T> => {
		const callId = ++lastCallId.current;

		if (!state.loading) {
			set_state((prevState): TStateFromFunctionReturningPromise<T> => ({...prevState, loading: true}));
		}

		return fn(...args).then(
			(value): TStateFromFunctionReturningPromise<T> => {
				isMounted() && callId === lastCallId.current && set_state({value, loading: false});

				return value;
			},
			(error): TStateFromFunctionReturningPromise<T> => {
				isMounted() && callId === lastCallId.current && set_state({error, loading: false});

				return error;
			}
		) as ReturnType<T>;
	}, deps);

	return [state, callback as unknown as T];
}

export function useAsync<T extends TFunctionReturningPromise>(
	fn: T,
	deps: DependencyList = []
): TStateFromFunctionReturningPromise<T> {
	const [state, callback] = useAsyncFn(fn, deps, {loading: true});

	useEffect((): void => {
		callback();
	}, [callback]);

	return state;
}