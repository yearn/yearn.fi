import {useIsMounted} from '@react-hookz/web';

type TProps = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	fn: (...args: any[]) => string | number | null | undefined;
	placeholder?: string | number | null;
}

export function useClientOnlyFn({fn, placeholder}: TProps): TProps['fn'] {
	const isMounted = useIsMounted();

	if (!isMounted()) {
		return (): ReturnType<TProps['fn']> => placeholder;
	}

	return fn;
}
