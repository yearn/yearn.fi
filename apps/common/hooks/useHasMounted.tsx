import {useState} from 'react';
import {useMountEffect} from '@react-hookz/web';

export function useHasMounted(): boolean {
	const [hasMounted, set_hasMounted] = useState(false);

	useMountEffect((): void => {
		set_hasMounted(true);
	});
	
	return hasMounted;
}

