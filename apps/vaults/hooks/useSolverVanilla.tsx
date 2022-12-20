import {useCallback, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import useSWRMutation from 'swr/mutation';
import {isZeroAddress} from '@yearn-finance/web-lib/utils/address';
import {useAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import {approveERC20} from '@common/utils/actions/approveToken';
import {deposit} from '@common/utils/actions/deposit';
import {withdrawShares} from '@common/utils/actions/withdrawShares';

import type {TAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import type {TNormalizedBN} from '@common/types/types';
import type {TVanillaRequest, TVanillaResult, TVanillaSolverContext} from '@vaults/types/solvers.vanilla';

function useVanillaQuote(): [TVanillaResult, (request: TVanillaRequest) => Promise<void>] {
	const allowanceFetcher = useAllowanceFetcher();
	const fetchAllowance = useCallback(async(url: string, data: {arg: TAllowanceFetcher}): Promise<TNormalizedBN> => {
		url;
		return allowanceFetcher(data.arg);
	}, [allowanceFetcher]);

	const {data, error, trigger, isMutating} = useSWRMutation('vanillaQuote', fetchAllowance);

	const getQuote = useCallback(async (request: TVanillaRequest): Promise<void> => {
		const canExecuteFetch = request.inputToken !== undefined && request.outputToken !== undefined && !isZeroAddress(request.inputToken?.value) && !isZeroAddress(request.outputToken?.value);
		if (canExecuteFetch) {
			trigger([request.inputToken, request.outputToken], {revalidate: false});
		}
	}, [trigger]);

	return [
		useMemo((): TVanillaResult => ({
			result: data || ({raw: ethers.constants.Zero, normalized: 0}),
			isLoading: isMutating,
			error
		}), [data, error, isMutating]),
		getQuote
	];
}

export function useSolverVanilla(): TVanillaSolverContext {
	const [request, set_request] = useState<TVanillaRequest>();
	const [latestQuote, getQuote] = useVanillaQuote();

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.
	**********************************************************************************************/
	const init = useCallback(async (_request: TVanillaRequest): Promise<void> => {
		set_request(_request);
		getQuote(_request);
	}, [getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** refreshQuote can be called by the user to refresh the quote. The same parameters are used
	** as in the initial request and it will fails if request is not set.
	** init should be called first to initialize the request.
	**********************************************************************************************/
	const	refreshQuote = useCallback(async (): Promise<void> => {
		if (!request) {
			return;
		}
		getQuote(request);
	}, [request, getQuote]);

	return useMemo((): TVanillaSolverContext => ({
		quote: latestQuote,
		getQuote: getQuote,
		refreshQuote: refreshQuote,
		init,
		approve: approveERC20,
		executeDeposit: deposit,
		executeWithdraw: withdrawShares
	}), [latestQuote, getQuote, refreshQuote, init]);
}
