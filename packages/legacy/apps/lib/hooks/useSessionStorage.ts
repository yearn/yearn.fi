import type {Dispatch, RefObject, SetStateAction} from 'react';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {deserialize, serialize} from 'wagmi';

declare global {
	interface WindowEventMap {
		'session-storage': CustomEvent;
	}
}

type TSetValue<T> = Dispatch<SetStateAction<T>>;

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function useEventCallback<TArgs extends unknown[], TR>(fn: (...args: TArgs) => TR): (...args: TArgs) => TR {
	const ref = useRef<typeof fn>((): never => {
		throw new Error('Cannot call an event handler while rendering.');
	});

	useIsomorphicLayoutEffect((): void => {
		ref.current = fn;
	}, [fn]);

	return useCallback((...args: TArgs): TR => ref.current(...args), []);
}

// Window Event based useEventListener interface
function useEventListener<TK extends keyof WindowEventMap>(
	eventName: TK,
	handler: (event: WindowEventMap[TK]) => void,
	element?: undefined,
	options?: boolean | AddEventListenerOptions
): void;

// Element Event based useEventListener interface
function useEventListener<TK extends keyof HTMLElementEventMap, T extends HTMLElement = HTMLDivElement>(
	eventName: TK,
	handler: (event: HTMLElementEventMap[TK]) => void,
	element: RefObject<T>,
	options?: boolean | AddEventListenerOptions
): void;

// Document Event based useEventListener interface
function useEventListener<TK extends keyof DocumentEventMap>(
	eventName: TK,
	handler: (event: DocumentEventMap[TK]) => void,
	element: RefObject<Document>,
	options?: boolean | AddEventListenerOptions
): void;

function useEventListener<
	TKW extends keyof WindowEventMap,
	TKH extends keyof HTMLElementEventMap,
	T extends HTMLElement | void = void
>(
	eventName: TKW | TKH,
	handler: (event: WindowEventMap[TKW] | HTMLElementEventMap[TKH] | Event) => void,
	element?: RefObject<T>,
	options?: boolean | AddEventListenerOptions
): void {
	// Create a ref that stores handler
	const savedHandler = useRef(handler);

	useIsomorphicLayoutEffect((): void => {
		savedHandler.current = handler;
	}, [handler]);

	useEffect((): void | VoidFunction => {
		// Define the listening target
		const targetElement: T | Window = element?.current || window;
		if (!targetElement?.addEventListener) {
			return;
		}

		// Create event listener that calls handler function stored in ref
		const eventListener: typeof handler = (event): unknown => savedHandler.current(event);

		targetElement.addEventListener(eventName, eventListener, options);

		// Remove event listener on cleanup
		return (): void => {
			targetElement.removeEventListener(eventName, eventListener);
		};
	}, [eventName, element, options]);
}

function useSessionStorage<T>(key: string, initialValue: T): [T, TSetValue<T>] {
	// Get from session storage then
	// parse stored json or return initialValue
	const readValue = useCallback((): T => {
		// Prevent build error "window is undefined" but keep keep working
		if (typeof window === 'undefined') {
			return initialValue;
		}

		try {
			const item = window.sessionStorage.getItem(key);
			return item ? deserialize(item) : initialValue;
		} catch (error) {
			console.warn(`Error reading sessionStorage key “${key}”:`, error);
			return initialValue;
		}
	}, [initialValue, key]);

	// State to store our value
	// Pass initial state function to useState so logic is only executed once
	const [storedValue, set_storedValue] = useState<T>(readValue);

	// Return a wrapped version of useState's setter function that ...
	// ... persists the new value to sessionStorage.
	const assignValue: TSetValue<T> = useEventCallback((value: unknown): void => {
		// Prevent build error "window is undefined" but keeps working
		if (typeof window === 'undefined') {
			console.warn(`Tried setting sessionStorage key “${key}” even though environment is not a client`);
		}

		try {
			// Allow value to be a function so we have the same API as useState
			const newValue = value instanceof Function ? value(storedValue) : value;

			// Save to session storage
			window.sessionStorage.setItem(key, serialize(newValue));

			// Save state
			set_storedValue(newValue);

			// We dispatch a custom event so every useSessionStorage hook are notified
			window.dispatchEvent(new Event('session-storage'));
		} catch (error) {
			console.warn(`Error setting sessionStorage key “${key}”:`, error);
		}
	});

	useEffect((): void => {
		set_storedValue(readValue());
	}, [readValue]);

	const handleStorageChange = useCallback(
		(event: StorageEvent | CustomEvent): void => {
			if ((event as StorageEvent)?.key && (event as StorageEvent).key !== key) {
				return;
			}
			set_storedValue(readValue());
		},
		[key, readValue]
	);

	// this only works for other documents, not the current one
	useEventListener('storage', handleStorageChange);

	// this is a custom event, triggered in writeValueTosessionStorage
	// See: useSessionStorage()
	useEventListener('session-storage', handleStorageChange);

	return [storedValue, assignValue];
}

export {useSessionStorage};
