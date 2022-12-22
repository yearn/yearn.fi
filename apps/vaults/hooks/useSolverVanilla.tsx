import {useCallback, useMemo, useState} from 'react';
import useSWRMutation from 'swr/mutation';
import {useVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import {isZeroAddress} from '@yearn-finance/web-lib/utils/address';
import {DefaultTNormalizedBN} from '@common/utils';
import {approveERC20} from '@common/utils/actions/approveToken';
import {deposit} from '@common/utils/actions/deposit';
import {withdrawShares} from '@common/utils/actions/withdrawShares';

import type {TNormalizedBN} from '@common/types/types';
import type {TVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import type {TInitSolverArgs, TSolverContext, TVanillaLikeResult} from '@vaults/types/solvers';

function useVanillaQuote(): [TVanillaLikeResult, (request: TInitSolverArgs) => Promise<TNormalizedBN>] {
	const retrieveExpectedOut = useVaultEstimateOutFetcher();
	const {data, error, trigger, isMutating} = useSWRMutation(
		'vanilla',
		async (_: string, data: {arg: TVaultEstimateOutFetcher}): Promise<TNormalizedBN> => retrieveExpectedOut(data.arg)
	);

	const getQuote = useCallback(async (request: TInitSolverArgs): Promise<TNormalizedBN> => {
		const canExecuteFetch = (
			!request.inputToken || !request.outputToken || !request.inputAmount ||
			!(isZeroAddress(request.inputToken.value) || isZeroAddress(request.outputToken.value) || request.inputAmount.isZero())
		);

		if (canExecuteFetch) {
			const result = await trigger([request.inputToken, request.outputToken, request.inputAmount, request.isDepositing]);
			return result || DefaultTNormalizedBN;
		}
		return DefaultTNormalizedBN;
	}, [trigger]);

	return [
		useMemo((): TVanillaLikeResult => ({
			result: data || DefaultTNormalizedBN,
			isLoading: isMutating,
			error
		}), [data, error, isMutating]),
		getQuote
	];
}


export function useSolverVanilla(): TSolverContext {
	const [request, set_request] = useState<TInitSolverArgs>();
	const [latestQuote, getQuote] = useVanillaQuote();

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN> => {
		set_request(_request);
		return await getQuote(_request);
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

	return useMemo((): TSolverContext => ({
		quote: latestQuote?.result || DefaultTNormalizedBN,
		getQuote: getQuote,
		refreshQuote: refreshQuote,
		init,
		approve: approveERC20,
		executeDeposit: deposit,
		executeWithdraw: withdrawShares
	}), [latestQuote, getQuote, refreshQuote, init]);
}
