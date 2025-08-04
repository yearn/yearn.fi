import type {Dispatch, SetStateAction} from 'react';
import {useState} from 'react';
import {deserialize, serialize} from 'wagmi';

export function useLocalStorage<T>(
	key: string,
	initialValue: T,
	options?: {
		currentVersion?: number;
		previousVersion?: number;
		shouldMigratePreviousVersion?: boolean;
	}
): [T, Dispatch<SetStateAction<T>>] {
	// State to store our value
	// Pass initial state function to useState so logic is only executed once
	const [storedValue, setStoredValue] = useState<T>((): T => {
		const _key = options?.currentVersion ? `${key}${options.currentVersion}` : key;
		try {
			if (typeof window === 'undefined') {
				return initialValue;
			}
			// Get from local storage by key
			const previousKey = options?.previousVersion !== undefined ? `${key}${options.previousVersion}` : key;
			const previousItem = window.localStorage.getItem(previousKey);
			const item = window.localStorage.getItem(_key);

			if (previousItem && options?.shouldMigratePreviousVersion) {
				const resp = serialize(previousItem);
				window.localStorage.setItem(_key, JSON.stringify(initialValue));
				window.localStorage.removeItem(key);
				return deserialize(resp);
			}
			if (item !== null) {
				// Parse stored json or if none return initialValue
				return deserialize(item);
			}
			//TODO: Should we do that ?
			// window.localStorage.setItem(key, JSON.stringify(initialValue));
			return initialValue;
		} catch (error) {
			// If error also return initialValue
			console.warn(error);
			return initialValue;
		}
	});

	// Return a wrapped version of useState's setter function that ...
	// ... persists the new value to localStorage.
	const setValue = (value: T | ((val: T) => T)): void => {
		const _key = options?.currentVersion ? `${key}-${options.currentVersion}` : key;
		try {
			// Allow value to be a function so we have same API as useState
			const valueToStore = value instanceof Function ? value(storedValue) : value;
			// Save state
			setStoredValue(valueToStore);
			// Save to local storage
			window.localStorage.setItem(_key, JSON.stringify(valueToStore));
		} catch (error) {
			console.warn(error);
		}
	};

	return [storedValue, setValue];
}
