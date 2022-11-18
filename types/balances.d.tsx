import	{BigNumber, ethers}	from	'ethers';

type	TDefaultReqArgs = {
	chainID?: number,
	provider?: ethers.providers.Provider,
}

export type	TDefaultStatus = {
	isFetching: boolean
	isFetched: boolean
	isRefetching: boolean
	isLoading: boolean
	isSuccess: boolean
	isError: boolean
}



/* 🔵 - Yearn Finance **********************************************************
** Request, Response and helpers for the useBalance hook.
******************************************************************************/
export type	TBalanceData = {
	decimals: number,
	symbol: string,
	raw: BigNumber,
	rawPrice: BigNumber,
	normalized: number,
	normalizedPrice: number,
	normalizedValue: number
}

export type	TUseBalanceReq = {
	for?: string,
	token?: string,
	refreshEvery?: 'block' | 'second' | 'minute' | 'hour' | number | undefined
} & TDefaultReqArgs

export type	TUseBalanceRes = {
	data: TBalanceData,
	update: () => Promise<void>,
	error?: Error,
	status: 'error' | 'loading' | 'success' | 'unknown'
} & TDefaultStatus 


/* 🔵 - Yearn Finance **********************************************************
** Request, Response and helpers for the useBalances hook.
******************************************************************************/
export type	TUseBalancesTokens = {
	token?: string,
	for?: string,
}
export type	TUseBalancesReq = {
	key: string | number,
	tokens: TUseBalancesTokens[]
	prices?: {
		[token: string]: string,
	}
	refreshEvery?: 'block' | 'second' | 'minute' | 'hour' | number | undefined,
	effectDependencies: any[]
} & TDefaultReqArgs

export type	TUseBalancesRes = {
	data: {
		[key: string]: TBalanceData
	},
	update: () => Promise<void>,
	error?: Error,
	status: 'error' | 'loading' | 'success' | 'unknown'
} & TDefaultStatus 
