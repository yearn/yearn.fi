import {useCallback, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import useSWRMutation from 'swr/mutation';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {DefaultTNormalizedBN} from '@common/utils';
import {approveERC20} from '@common/utils/actions/approveToken';
import {depositETH} from '@common/utils/actions/depositEth';
import {withdrawETH} from '@common/utils/actions/withdrawEth';

import type {TNormalizedBN} from '@common/types/types';
import type {TSolverContext} from '@vaults/types/solvers';
import type {TChainCoinAPIRequest, TChainCoinRequest, TChainCoinResult} from '@vaults/types/solvers.chainCoin';

function useChainCoinQuote(): [TChainCoinResult, (request: TChainCoinRequest) => Promise<void>] {
	const {provider, chainID} = useWeb3();

	const fetchAllowance = useCallback(async(_url: string, data: {arg: TChainCoinAPIRequest}): Promise<TNormalizedBN> => {
		const	[inputToken, outputToken, inputAmount, isDepositing] = data.arg;
		if (isZeroAddress(inputToken?.value) || isZeroAddress(outputToken?.value) || inputAmount?.raw?.isZero()) {
			return (DefaultTNormalizedBN);
		}

		const	currentProvider = provider || getProvider(chainID);
		const	contract = new ethers.Contract(
			toAddress(isDepositing ? outputToken.value : inputToken.value),
			['function pricePerShare() public view returns (uint256)'],
			currentProvider
		);
		try {
			const	pps = await contract.pricePerShare() || ethers.constants.Zero;
			if (isDepositing) {
				const	expectedOutFetched = (inputAmount.raw).mul(ethers.constants.WeiPerEther).div(pps);
				return ({
					raw: expectedOutFetched,
					normalized: formatToNormalizedValue(expectedOutFetched || ethers.constants.Zero, outputToken?.decimals || 18)
				});
			} else {
				const	expectedOutFetched = (inputAmount.raw).mul(pps).div(ethers.constants.WeiPerEther);
				return ({
					raw: expectedOutFetched,
					normalized: formatToNormalizedValue(expectedOutFetched || ethers.constants.Zero, outputToken?.decimals || 18)
				});
			}
		} catch (error) {
			console.log(error);
			return (DefaultTNormalizedBN);
		}
	}, [chainID, provider]);

	const {data, error, trigger, isMutating} = useSWRMutation('chainCoinQuote', fetchAllowance);

	const getQuote = useCallback(async (request: TChainCoinRequest): Promise<void> => {
		const canExecuteFetch = (
			!request.inputToken || !request.outputToken || !request.inputAmount ||
			!(isZeroAddress(request.inputToken.value) || isZeroAddress(request.outputToken.value) || request.inputAmount.raw.isZero())
		);

		if (canExecuteFetch) {
			trigger([request.inputToken, request.outputToken, request.inputAmount, request.isDepositing]);
		}
	}, [trigger]);

	return [
		useMemo((): TChainCoinResult => ({
			result: data || DefaultTNormalizedBN,
			isLoading: isMutating,
			error
		}), [data, error, isMutating]),
		getQuote
	];
}

export function useSolverChainCoin(): TSolverContext {
	const [request, set_request] = useState<TChainCoinRequest>();
	const [latestQuote, getQuote] = useChainCoinQuote();

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.
	**********************************************************************************************/
	const init = useCallback(async (_request: TChainCoinRequest): Promise<void> => {
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

	return useMemo((): TSolverContext => ({
		quote: latestQuote?.result || DefaultTNormalizedBN,
		getQuote: getQuote,
		refreshQuote: refreshQuote,
		init,
		isLoadingQuote: latestQuote?.isLoading || false,
		approve: approveERC20,
		executeDeposit: depositETH,
		executeWithdraw: withdrawETH
	}), [latestQuote?.result, latestQuote?.isLoading, getQuote, refreshQuote, init]);
}
