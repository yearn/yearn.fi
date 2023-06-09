import axios from 'axios';
import * as Sentry from '@sentry/nextjs';

import type {AxiosRequestConfig, AxiosResponse} from 'axios';
import type {z} from 'zod';

type TFetchProps = {
	endpoint: string | null;
	schema: z.ZodSchema;
	config?: AxiosRequestConfig<unknown>;
}

export type TFetchReturn<T> = Promise<Partial<AxiosResponse<T> & {error?: Error | undefined}>>

export async function fetch<T>({endpoint, schema, config}: TFetchProps): TFetchReturn<T> {
	if (!endpoint) {
		return {data: undefined, error: new Error('No endpoint provided')};
	}

	try {
		const result = await axios.get<T>(endpoint, config);

		if (!result.data) {
			return {data: undefined, error: new Error('No data')};
		}

		const parsedData = schema.safeParse(result.data);
	
		if (!parsedData.success) {
			console.error(endpoint, parsedData.error);
			Sentry.captureException(parsedData.error, {tags: {endpoint}});
			return {...result, error: parsedData.error};
		}
	
		return {...result, data: parsedData.data};
	} catch (error) {
		console.error(endpoint, error);
		Sentry.captureException(error, {tags: {endpoint}});
		if (error instanceof Error) {
			return {data: undefined, error};
		}
		return {data: undefined, error: new Error(JSON.stringify(error))};
	}
}
