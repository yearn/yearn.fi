import {quote} from 'quote';

import type {QuoteRequest as TWidoRequest, QuoteResult as TWidoResult} from 'wido';

export type TWidoQuote = { req: { type: 'wido'; request: TWidoRequest }; res: TWidoResult };

type TPortalsRequest = {
    network: string; // The network to use (ethereum, avalanche, etc.)
    sellToken: string; // The ERC20 token address to spend
    sellAmount: string; // The quantity of `sellToken` to spend
    buyToken: string; // The ERC20 token address to buy (e.g. a Curve or Sushiswap pool, or a basic token like DAI). Use address(0) for the network token
    slippagePercentage: number; // The maximum acceptable slippage for the portal. Must be a number between 0 and 1 (e.g. 0.005 for 0.5%)
}

type TPortalsResult = {
    buyToken: string;
    buyAmount: string;
    minBuyAmount: string;
    buyTokenDecimals: number;
}

export type TPortalsQuote = { req: { type: 'portals'; request: TPortalsRequest }; res: TPortalsResult };

// TODO
export type TCowQuote = { req: { type: 'cow'; request: unknown }; res: unknown };

type TExternalService<T> =
    T extends 'wido' ? TWidoQuote :
    T extends 'portals' ? TPortalsQuote :
    T extends 'cow' ? TCowQuote :
	never;

export async function useExternalQuote<T>({type, request}: TExternalService<T>['req']): Promise<TExternalService<T>['res']> {
	switch (type) {
	case 'wido':
		return widoQuote(request);
	case 'portals':
		return portalsQuote(request);
	case 'cow':
		return cowQuote(request);
	default:
		throw new Error(`Unknown service ${type}`);
	}
}

async function widoQuote(request: TWidoQuote['req']['request']): Promise<TWidoQuote['res']> {
	return quote(request);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
async function portalsQuote(_request: TPortalsQuote['req']['request']): Promise<TPortalsQuote['res']> {
	throw new Error('Function not implemented.');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
async function cowQuote(_request: TCowQuote['req']['request']): Promise<TCowQuote['res']> {
	throw new Error('Function not implemented.');
}
