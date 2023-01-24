

import type {QuoteResult} from 'wido';

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the Wido
**	Quote API.
**	TWidoAPIResult is the response from the API.
**	TWidoResult is what we will send as response for the use of the
**	useWido hook.
***************************************************************************/
export type TWidoAPIResult = QuoteResult;
export type TWidoResult = {
	result: QuoteResult | undefined,
	isLoading: boolean,
	error: Error | undefined
}
