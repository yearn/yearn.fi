import useSWR from 'swr';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';

import type {SWRResponse} from 'swr';
import type {z} from 'zod';

type TUseZodProps = {
	endpoint: string;
	schema: z.ZodSchema;
}

export function	useZod<T>({endpoint, schema}: TUseZodProps): SWRResponse<T> {
	const result = useSWR<T>(endpoint, baseFetcher, {revalidateOnFocus: false});

	if (!result.data || result.isLoading || result.isValidating) {
		return result;
	}

	if (result.error) {
		// TODO Send to Sentry
		console.error(endpoint, result.error);
		return result;
	}

	const parsedData = schema.safeParse(result.data);
	
	if (!parsedData.success) {
		// TODO Send to Sentry
		console.error(endpoint, parsedData.error);
		return result;
	}

	return {...result, data: parsedData.data};
}
