import {useEffect, useState} from 'react';

export function useHasMounted(): boolean {
	const [hasMounted, set_hasMounted] = useState(false);

	useEffect((): void => {
		set_hasMounted(true);
	}, []);

	return hasMounted;
}
