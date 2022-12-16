import {useState} from 'react';

export const useSessionStorage = (key: string, defaultValue: string): [string, (_: string) => void] => {
	const [storedValue, set_storedValue] = useState((): string => {
		try {
			const value = window.sessionStorage.getItem(key);

			if (value) {
				return value;
			} else {
				window.sessionStorage.setItem(key, defaultValue);
				return defaultValue;
			}
		} catch (err) {
			console.error(err);
			return defaultValue;
		}
	});

	const set_value = (newValue: string): void => {
		try {
			window.sessionStorage.setItem(key, newValue);
			set_storedValue(newValue);
		} catch (err) {
			console.error(err);
		}
	};

	return [storedValue, set_value];
};
