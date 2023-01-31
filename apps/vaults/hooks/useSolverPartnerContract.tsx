import {useCallback, useMemo, useRef} from 'react';
import {ethers} from 'ethers';
import useSWRMutation from 'swr/mutation';
import {Solver} from '@vaults/contexts/useSolver';
import {useVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useYearn} from '@common/contexts/useYearn';
import {approvedERC20Amount, approveERC20} from '@common/utils/actions/approveToken';
import {depositViaPartner} from '@common/utils/actions/depositViaPartner';
import {withdrawShares} from '@common/utils/actions/withdrawShares';

import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {TVaultEstimateOutFetcher} from '@vaults/hooks/useVaultEstimateOutFetcher';
import type {TInitSolverArgs, TSolverContext, TVanillaLikeResult} from '@vaults/types/solvers';

function usePartnerContractQuote(): [TVanillaLikeResult, (request: TInitSolverArgs, shouldPreventErrorToast?: boolean) => Promise<TNormalizedBN>] {
	const retrieveExpectedOut = useVaultEstimateOutFetcher();
	const {data, error, trigger, isMutating} = useSWRMutation(
		'partnerContract',
		async (_: string, data: {arg: TVaultEstimateOutFetcher}): Promise<TNormalizedBN> => retrieveExpectedOut(data.arg)
	);

	const getQuote = useCallback(async (
		request: TInitSolverArgs,
		shouldPreventErrorToast = false //do nothing, for consistency with other solvers
	): Promise<TNormalizedBN> => {
		shouldPreventErrorToast;

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

export function useSolverPartnerContract(): TSolverContext {
	const {networks} = useSettings();
	const {provider} = useWeb3();
	const {safeChainID} = useChainID();
	const {currentPartner} = useYearn();
	const [latestQuote, getQuote] = usePartnerContractQuote();
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
	** Retrieve the current outValue from the quote, which will be used to
	** display the current value to the user.
	**************************************************************************/
	const onRetrieveExpectedOut = useCallback(async (request: TInitSolverArgs): Promise<TNormalizedBN> => {
		const	quoteResult = await getQuote(request, true);
		return quoteResult;
	}, [getQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the allowance for the token to be used by the solver. This will
	** be used to determine if the user should approve the token or not.
	**************************************************************************/
	const onRetrieveAllowance = useCallback(async (): Promise<TNormalizedBN> => {
		if (!request?.current) {
			return toNormalizedBN(0);
		}

		const allowance = await approvedERC20Amount(
			provider as ethers.providers.Web3Provider,
			toAddress(request.current.inputToken.value), //Input token
			toAddress(networks[safeChainID].partnerContractAddress) //spender aka partner contract
		);
		return toNormalizedBN(allowance, request.current.inputToken.decimals);
	}, [request, provider, networks, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the Partner contract or the final vault, in charge of
	** depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = ethers.constants.MaxUint256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!request?.current?.inputToken || !request?.current?.outputToken || !request?.current?.inputAmount) {
			return;
		}

		new Transaction(provider, approveERC20, txStatusSetter)
			.populate(
				toAddress(request.current.inputToken.value), //token to approve
				toAddress(networks[safeChainID].partnerContractAddress), //partner contract
				amount //amount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [networks, provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action, simply trying to deposit `amount` tokens
	** via the Partner Contract, to the selected vault.
	**************************************************************************/
	const onExecuteDeposit = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!request?.current?.inputToken || !request?.current?.outputToken || !request?.current?.inputAmount) {
			return;
		}

		new Transaction(provider, depositViaPartner, txStatusSetter)
			.populate(
				networks[safeChainID].partnerContractAddress,
				currentPartner,
				toAddress(request.current.outputToken.value),
				request.current.inputAmount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [currentPartner, networks, provider, safeChainID]);

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
		type: Solver.PARTNER_CONTRACT,
		quote: latestQuote?.result || toNormalizedBN(0),
		getQuote: getQuote,
		refreshQuote: refreshQuote,
		init,
		onRetrieveExpectedOut,
		onRetrieveAllowance,
		onApprove,
		onExecuteDeposit,
		onExecuteWithdraw
	}), [latestQuote?.result, getQuote, refreshQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance, onRetrieveExpectedOut]);
}
