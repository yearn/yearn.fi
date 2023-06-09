import axios from 'axios';
import * as Sentry from '@sentry/nextjs';

import type {AxiosRequestConfig, AxiosResponse} from 'axios';
import type {z} from 'zod';

type TFetchProps = {
	endpoint: string | null;
	schema: z.ZodSchema;
	config?: AxiosRequestConfig<unknown>;
}

type TFetchReturn<T> = Promise<Partial<AxiosResponse<T>> & {isSuccess: boolean}>

export async function fetch<T>({endpoint, schema, config}: TFetchProps): TFetchReturn<T> {
	if (!endpoint) {
		return {isSuccess: false};
	}

	try {
		const result = await axios.get<T>(endpoint, config);

		if (!result.data) {
			return {isSuccess: false};
		}

		const parsedData = schema.safeParse(result.data);
	
		if (!parsedData.success) {
			console.error(endpoint, parsedData.error);
			Sentry.captureException(parsedData.error, {tags: {endpoint}});
			return {...result, isSuccess: false};
		}
	
		return {...result, data: parsedData.data, isSuccess: true};
	} catch (error) {
		console.error(endpoint, error);
		Sentry.captureException(error, {tags: {endpoint}});
		return {isSuccess: false};
	}
}
