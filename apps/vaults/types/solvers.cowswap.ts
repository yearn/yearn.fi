
import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {Order} from '@gnosis.pm/gp-v2-contracts';

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the Cowswap
**	Quote API.
**	TCowRequest is the requirement to execute a quote request.
**	TCowAPIResult is the response from the API.
**	TCowResult is what we will send as response for the use of the
**	useCowQuote hook.
***************************************************************************/
export type TCowRequest = {
	from: TAddress,
    sellToken: TAddress;
    buyToken: TAddress;
    sellAmount: BigNumber;
	sellTokenDecimals: number;
	buyTokenDecimals: number;
}
export type TCowAPIResult = {
	quote: Order;
	from: string;
	expiration: string;
	id: number;
}
export type TCowResult = {
	result: TCowAPIResult | undefined,
	isLoading: boolean,
	error: Error | undefined
}
