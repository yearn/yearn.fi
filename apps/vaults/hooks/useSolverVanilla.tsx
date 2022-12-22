import {useCallback, useMemo, useRef} from 'react';
import {ethers} from 'ethers';
import useSWRMutation from 'swr/mutation';
import {useVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {DefaultTNormalizedBN} from '@common/utils';
import {approveERC20} from '@common/utils/actions/approveToken';
import {deposit} from '@common/utils/actions/deposit';
import {withdrawShares} from '@common/utils/actions/withdrawShares';

import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
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
	const {provider} = useWeb3();
	const [latestQuote, getQuote] = useVanillaQuote();
	const request = useRef<TInitSolverArgs>();

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN> => {
		request.current = _request;
		return await getQuote(_request);
	}, [getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** refreshQuote can be called by the user to refresh the quote. The same parameters are used
	** as in the initial request and it will fails if request is not set.
	** init should be called first to initialize the request.
	**********************************************************************************************/
	const	refreshQuote = useCallback(async (): Promise<void> => {
		if (request.current) {
			getQuote(request.current);
		}
	}, [request, getQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the final vault, in charge of depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	const onApprove = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!request?.current?.inputToken || !request?.current?.outputToken || !request?.current?.inputAmount) {
			return;
		}

		new Transaction(provider, approveERC20, txStatusSetter)
			.populate(
				toAddress(request.current.inputToken.value), //token to approve
				toAddress(request.current.outputToken.value), //partner contract 
				ethers.constants.MaxUint256 //amount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action, simply trying to deposit `amount` tokens to
	** the selected vault.
	**************************************************************************/
	const onExecuteDeposit = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!request?.current?.inputToken || !request?.current?.outputToken || !request?.current?.inputAmount) {
			return;
		}

		new Transaction(provider, deposit, txStatusSetter)
			.populate(
				toAddress(request.current.outputToken.value),
				request.current.inputAmount //amount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the vault contract to take back
	** some underlying token from this specific vault.
	**************************************************************************/
	const onExecuteWithdraw = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!request?.current?.inputToken || !request?.current?.outputToken || !request?.current?.inputAmount) {
			return;
		}

		new Transaction(provider, withdrawShares, txStatusSetter)
			.populate(
				toAddress(request.current.inputToken.value), //vault address
				request.current.inputAmount //amount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [provider]);


	return useMemo((): TSolverContext => ({
		quote: latestQuote?.result || DefaultTNormalizedBN,
		getQuote: getQuote,
		refreshQuote: refreshQuote,
		init,
		onApprove: onApprove,
		onExecuteDeposit: onExecuteDeposit,
		onExecuteWithdraw: onExecuteWithdraw
	}), [latestQuote?.result, getQuote, refreshQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw]);
}
