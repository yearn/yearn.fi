import {useCallback, useMemo, useRef} from 'react';
import {ethers} from 'ethers';
import useSWRMutation from 'swr/mutation';
import {useVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import {getEthZapperContract} from '@vaults/utils';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {approveERC20} from '@common/utils/actions/approveToken';
import {depositETH} from '@common/utils/actions/depositEth';
import {withdrawETH} from '@common/utils/actions/withdrawEth';

import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {TVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import type {TInitSolverArgs, TSolverContext, TVanillaLikeResult} from '@vaults/types/solvers';

function useChainCoinQuote(): [TVanillaLikeResult, (request: TInitSolverArgs) => Promise<TNormalizedBN>] {
	const retrieveExpectedOut = useVaultEstimateOutFetcher();
	const {data, error, trigger, isMutating} = useSWRMutation(
		'chainCoinQuote',
		async (_: string, data: {arg: TVaultEstimateOutFetcher}): Promise<TNormalizedBN> => retrieveExpectedOut(data.arg)
	);

	const getQuote = useCallback(async (request: TInitSolverArgs): Promise<TNormalizedBN> => {
		const canExecuteFetch = (
			!request.inputToken || !request.outputToken || !request.inputAmount ||
			!(isZeroAddress(request.inputToken.value) || isZeroAddress(request.outputToken.value) || request.inputAmount.isZero())
		);

		if (canExecuteFetch) {
			const result = await trigger([request.inputToken, request.outputToken, request.inputAmount, request.isDepositing]);
			return result || toNormalizedBN(0);
		}
		return toNormalizedBN(0);
	}, [trigger]);

	return [
		useMemo((): TVanillaLikeResult => ({
			result: data || toNormalizedBN(0),
			isLoading: isMutating,
			error
		}), [data, error, isMutating]),
		getQuote
	];
}

export function useSolverChainCoin(): TSolverContext {
	const {provider} = useWeb3();
	const {safeChainID} = useChainID();
	const [latestQuote, getQuote] = useChainCoinQuote();
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
	** When we want to withdraw a yvWrappedCoin to the base chain coin, we first
	** need to approve the yvWrappedCoin to be used by the zap contract.
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
				toAddress(request.current.inputToken.value), // Token to approve (wrapped coin)
				getEthZapperContract(safeChainID), // Coin Zap Contract
				ethers.constants.MaxUint256 //amount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action using the ETH zap contract to deposit ETH
	** to the selected yvETH vault. The contract will first convert ETH to WETH,
	** aka the vault underlying token, and then deposit it to the vault.
	**************************************************************************/
	const onExecuteDeposit = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!request?.current?.inputToken || !request?.current?.outputToken || !request?.current?.inputAmount) {
			return;
		}

		new Transaction(provider, depositETH, txStatusSetter)
			.populate(
				safeChainID, //ChainID to get the correct zap contract
				request.current.inputAmount //amount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the ETH zap contract to take back
	** some ETH from the selected yvETH vault. The contract will first convert
	** yvETH to wETH, unwrap the wETH and send them to the user.
	**************************************************************************/
	const onExecuteWithdraw = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!request?.current?.inputToken || !request?.current?.outputToken || !request?.current?.inputAmount) {
			return;
		}

		new Transaction(provider, withdrawETH, txStatusSetter)
			.populate(
				safeChainID, //ChainID to get the correct zap contract
				request.current.inputAmount //amount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [provider, safeChainID]);

	return useMemo((): TSolverContext => ({
		quote: latestQuote?.result || toNormalizedBN(0),
		getQuote: getQuote,
		refreshQuote: refreshQuote,
		init,
		onApprove: onApprove,
		onExecuteDeposit: onExecuteDeposit,
		onExecuteWithdraw: onExecuteWithdraw
	}), [latestQuote?.result, getQuote, refreshQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw]);
}
