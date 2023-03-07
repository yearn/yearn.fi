

import type {QuoteResult} from 'wido';
import type {Maybe} from '@yearn-finance/web-lib/types';

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the Wido
**	Quote API.
**	TWidoAPIResult is the response from the API.
**	TWidoResult is what we will send as response for the use of the
**	useWido hook.
***************************************************************************/
export type TWidoAPIResult = QuoteResult;
export type TWidoResult = {
	result: Maybe<QuoteResult>,
	error: Maybe<Error>,
	isLoading: boolean
}
