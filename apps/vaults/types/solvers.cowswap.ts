
import type {Maybe} from '@yearn-finance/web-lib/types';
import type {Order} from '@cowprotocol/contracts';

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the Cowswap
**	Quote API.
**	TCowRequest is the requirement to execute a quote request.
**	TCowAPIResult is the response from the API.
**	TCowResult is what we will send as response for the use of the
**	useCowQuote hook.
***************************************************************************/
export type TCowAPIResult = {
	quote: Order;
	from: string;
	expiration: string;
	id: number;
}
export type TCowResult = {
	result: Maybe<TCowAPIResult>,
	error: Maybe<Error>,
	isLoading: boolean
}
