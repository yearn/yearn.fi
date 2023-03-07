import {useIsMounted} from '@react-hookz/web';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useClientOnlyFn(fn: (...args: any[]) => string): (...args: any[]) => string | null {
	const isMounted = useIsMounted();

	if (!isMounted()) {
		return (): null => null;
	}

	return fn;
}
