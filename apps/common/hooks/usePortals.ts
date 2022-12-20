export type TUsePortals = {
	portalsQuote: TPortalsResult;
    getPortalsQuote: (request: TRequest) => Promise<void>;
}

type TPortalsResult = {
    isLoading: boolean,
	result?: TResult;
	error?: Error;
}

type TRequest = {
    network: string; // The network to use (ethereum, avalanche, etc.)
    sellToken: string; // The ERC20 token address to spend
    sellAmount: string; // The quantity of `sellToken` to spend
    buyToken: string; // The ERC20 token address to buy (e.g. a Curve or Sushiswap pool, or a basic token like DAI). Use address(0) for the network token
    slippagePercentage: number; // The maximum acceptable slippage for the portal. Must be a number between 0 and 1 (e.g. 0.005 for 0.5%)
}

type TResult = {
    buyToken: string;
    buyAmount: string;
    minBuyAmount: string;
    buyTokenDecimals: number;
}


export function usePortals(): TUsePortals {
	return ({
		portalsQuote: {
			isLoading: false
		},
		getPortalsQuote: async (): Promise<void> => undefined
	});
}
