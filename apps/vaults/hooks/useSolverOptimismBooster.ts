import {useCallback, useMemo, useRef} from 'react';
import useSWRMutation from 'swr/mutation';
import {Solver} from '@vaults/contexts/useSolver';
import {useVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import {depositAndStake} from '@vaults/utils/actions';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, isZeroAddress, toAddress, toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256, STAKING_REWARDS_ZAP_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {approvedERC20Amount, approveERC20} from '@common/utils/actions';
import {assert} from '@common/utils/assert';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {TVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import type {TInitSolverArgs, TSolverContext, TVanillaLikeResult} from '@vaults/types/solvers';

function useQuote(): [TVanillaLikeResult, (request: TInitSolverArgs, shouldPreventErrorToast?: boolean) => Promise<TNormalizedBN>] {
	const retrieveExpectedOut = useVaultEstimateOutFetcher();
	const {data, error, trigger, isMutating} = useSWRMutation(
		'stakingRewardsBoost',
		async (_: string, data: {arg: TVaultEstimateOutFetcher}): Promise<TNormalizedBN> => retrieveExpectedOut(data.arg)
	);

	const getQuote = useCallback(async (
		request: TInitSolverArgs,
		shouldPreventErrorToast = false //do nothing, for consistency with other solvers
	): Promise<TNormalizedBN> => {
		shouldPreventErrorToast;

		const canExecuteFetch = (
			!request.inputToken || !request.outputToken || !request.inputAmount ||
			!(isZeroAddress(request.inputToken.value) || isZeroAddress(request.outputToken.value) || request.inputAmount === 0n)
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

export function useSolverOptimismBooster(): TSolverContext {
	const {provider} = useWeb3();
	const {safeChainID} = useChainID();
	const [latestQuote, getQuote] = useQuote();
	const request = useRef<TInitSolverArgs>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the optimism booster should be used to perform the desired deposit.
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
	const refreshQuote = useCallback(async (): Promise<void> => {
		if (request.current) {
			getQuote(request.current);
		}
	}, [request, getQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the current outValue from the quote, which will be used to
	** display the current value to the user.
	**************************************************************************/
	const onRetrieveExpectedOut = useCallback(async (request: TInitSolverArgs): Promise<TNormalizedBN> => {
		const quoteResult = await getQuote(request, true);
		return quoteResult;
	}, [getQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the allowance for the token to be used by the solver. This will
	** be used to determine if the user should approve the token or not.
	**************************************************************************/
	const onRetrieveAllowance = useCallback(async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
		if (!request?.current) {
			return toNormalizedBN(0);
		}

		const key = allowanceKey(
			safeChainID,
			toAddress(request.current.inputToken.value),
			toAddress(request.current.outputToken.value),
			toAddress(request.current.from)
		);
		if (existingAllowances.current[key] && !shouldForceRefetch) {
			return existingAllowances.current[key];
		}

		assert(provider, 'Provider is not defined');
		const allowance = await approvedERC20Amount(
			provider,
			toAddress(request.current.inputToken.value), // Input token
			toAddress(STAKING_REWARDS_ZAP_ADDRESS) // spender
		);
		existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
		return existingAllowances.current[key];
	}, [request, safeChainID, provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = MAX_UINT_256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(provider, 'Provider is not set');
		assert(request.current, 'Request is not set');
		assert(request.current.inputToken, 'Input token is not set');

		const result = await approveERC20({
			connector: provider,
			contractAddress: toWagmiAddress(request.current.inputToken.value),
			spenderAddress: toWagmiAddress(STAKING_REWARDS_ZAP_ADDRESS),
			amount: amount,
			statusHandler: txStatusSetter
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}, [provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit and stake web3 action, simply trying to zap `amount`
	** tokens via the Staking Rewards Zap Contract, to the selected vault.
	**************************************************************************/
	const onExecuteDeposit = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(provider, 'Provider is not set');
		assert(request.current, 'Request is not set');

		//Asserting the basic request parameters
		const {outputToken, inputAmount} = request.current;
		assert(outputToken, 'Output token is not set');
		assert(inputAmount, 'Input amount is not set');

		const result = await depositAndStake({
			connector: provider,
			contractAddress: toWagmiAddress(STAKING_REWARDS_ZAP_ADDRESS),
			vaultAddress: toWagmiAddress(outputToken.value),
			amount: inputAmount,
			statusHandler: txStatusSetter
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}, [provider]);

	return useMemo((): TSolverContext => ({
		type: Solver.OPTIMISM_BOOSTER,
		quote: latestQuote?.result || toNormalizedBN(0),
		getQuote: getQuote,
		refreshQuote: refreshQuote,
		init,
		onRetrieveExpectedOut,
		onRetrieveAllowance,
		onApprove,
		onExecuteDeposit,
		onExecuteWithdraw: async (): Promise<void> => undefined
	}), [latestQuote?.result, getQuote, refreshQuote, init, onApprove, onExecuteDeposit, onRetrieveAllowance, onRetrieveExpectedOut]);
}
