import {useCallback, useMemo, useRef, useState} from 'react';
import {BigNumber, ethers} from 'ethers';
import axios from 'axios';
import {useAsync} from '@react-hookz/web';
import {isSolverDisabled, Solver} from '@vaults/contexts/useSolver';
import usePortalsApi from '@vaults/hooks/usePortalsApi';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useYearn} from '@common/contexts/useYearn';
import {approveERC20, isApprovedERC20} from '@common/utils/actions/approveToken';

import type {TTxResponse, TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {TPortalEstimate} from '@vaults/hooks/usePortalsApi';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export type TPortalsQuoteResult = {
	result?: TPortalEstimate | null;
	isLoading: boolean;
	error?: Error;
};

function usePortalsQuote(): [
	TPortalsQuoteResult,
	(request: TInitSolverArgs, shouldPreventErrorToast?: boolean) => Promise<TPortalEstimate | null>
] {
	const {toast} = yToast();
	const {zapSlippage} = useYearn();
	const [err, set_err] = useState<Error>();
	const {getEstimate} = usePortalsApi();
	const {safeChainID} = useChainID();

	const getQuote = useCallback(async (
		request: TInitSolverArgs,
		shouldPreventErrorToast = false
	): Promise<TPortalEstimate | null> => {
		const params = {
			sellToken: toAddress(request.inputToken.value),
			sellAmount: formatBN(request.inputAmount || 0).toString(),
			buyToken: toAddress(request.outputToken.value),
			slippagePercentage: String(zapSlippage / 100)
		};

		const canExecuteFetch = (
			!(isZeroAddress(params.sellToken) || isZeroAddress(params.buyToken)) &&
				!formatBN(request.inputAmount || 0).isZero()
		);

		if (!canExecuteFetch) {
			return null;
		}
		
		try {
			return getEstimate({network: safeChainID, params});
		} catch (error) {
			set_err(error instanceof Error ? error : new Error(`Unknown error: ${error}`));

			console.error(error);

			if (!shouldPreventErrorToast) {
				let errorContent = 'Zap not possible. Try again later or pick another token.';
				if (axios.isAxiosError(error)) {
					const description = error.response?.data?.description;
					errorContent += `${description ? ` (Reason: [${description}])` : ''}`;
				}
	
				toast({type: 'error', content: errorContent});
			}

			return null;
		}
	}, [getEstimate, safeChainID, toast, zapSlippage]);

	const [{result: data, status}] = useAsync(getQuote);

	return [
		{
			result: data,
			isLoading: status === 'loading',
			error: err
		},
		getQuote
	];
}

export function useSolverPortals(): TSolverContext {
	const {provider} = useWeb3();
	const [, getQuote] = usePortalsQuote();
	const request = useRef<TInitSolverArgs>();
	const latestQuote = useRef<TPortalEstimate>();
	const {address} = useWeb3();
	const {zapSlippage} = useYearn();
	const {getTransaction, getApproval} = usePortalsApi();
	const {safeChainID} = useChainID();

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the Portals solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.current.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN> => {
		if (isSolverDisabled[Solver.PORTALS]) {
			return toNormalizedBN(0);
		}
		request.current = _request;
		const quote = await getQuote(_request);
		if (quote) {
			latestQuote.current = quote;
			return toNormalizedBN(quote?.minBuyAmount || 0, request?.current?.outputToken?.decimals || 18);
		}
		return toNormalizedBN(0);
	}, [getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** refreshQuote can be called by the user to refresh the quote. The same parameters are used
	** as in the initial request and it will fails if request is not set.
	** init should be called first to initialize the request.current.
	**********************************************************************************************/
	const refreshQuote = useCallback(async (): Promise<void> => {
		if (request.current) {
			getQuote(request.current);
		}
	}, [request, getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (): Promise<TTxResponse> => {
		if (!latestQuote?.current || !request.current || isSolverDisabled[Solver.PORTALS]) {
			return ({isSuccessful: false});
		}

		try {
			const transaction = await getTransaction({
				network: safeChainID,
				params: {
					takerAddress: toAddress(address),
					sellToken: toAddress(request.current.inputToken.value),
					sellAmount: formatBN(request.current.inputAmount || 0).toString(),
					buyToken: toAddress(request.current.outputToken.value),
					slippagePercentage: String(zapSlippage / 100),
					validate: false
				}
			});

			if (!transaction) {
				throw new Error('Fail to get transaction');
			}
		
			const {tx: {value, gasLimit, ...rest}} = transaction;

			const signer = provider.getSigner();
			const transactionResponse = await signer.sendTransaction({
				value: BigNumber.from(value?.hex ?? 0),
				gasLimit: BigNumber.from(gasLimit?.hex ?? 0),
				...rest
			});
			const transactionReceipt = await transactionResponse.wait();
			if (transactionReceipt.status === 0) {
				console.error('Fail to perform transaction');
				return ({isSuccessful: false});
			}
			return ({isSuccessful: true, receipt: transactionReceipt});
		} catch (_error) {
			console.error(_error);
			return ({isSuccessful: false});
		}
	}, [address, getTransaction, provider, safeChainID, zapSlippage]);

	/* 🔵 - Yearn Finance ******************************************************
	** Format the quote to a normalized value, which will be used for subsequent
	** process and displayed to the user.
	**************************************************************************/
	const expectedOut = useMemo((): TNormalizedBN => {
		if (!latestQuote?.current?.minBuyAmount || isSolverDisabled[Solver.PORTALS]) {
			return (toNormalizedBN(0));
		}
		return toNormalizedBN(latestQuote?.current?.minBuyAmount, request?.current?.outputToken?.decimals || 18);
	}, [latestQuote, request]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the current outValue from the quote, which will be used to
	** display the current value to the user.
	**************************************************************************/
	const onRetrieveExpectedOut = useCallback(async (request: TInitSolverArgs): Promise<TNormalizedBN> => {
		if (isSolverDisabled[Solver.PORTALS]) {
			return toNormalizedBN(0);
		}
		const quoteResult = await getQuote(request, true);
		return toNormalizedBN(formatBN(quoteResult?.minBuyAmount), request.outputToken.decimals);
	}, [getQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the allowance for the token to be used by the solver. This will
	** be used to determine if the user should approve the token or not.
	**************************************************************************/
	const onRetrieveAllowance = useCallback(async (): Promise<TNormalizedBN> => {
		if (!latestQuote?.current || !request?.current || isSolverDisabled[Solver.PORTALS]) {
			return toNormalizedBN(0);
		}

		try {			
			const approval = await getApproval({
				network: safeChainID,
				params: {
					takerAddress: toAddress(request.current.from),
					sellToken: toAddress(request.current.inputToken.value),
					sellAmount:formatBN(request.current.inputAmount || 0).toString(),
					buyToken: toAddress(request.current.outputToken.value)
				}
			});

			if (!approval) {
				throw new Error('Fail to get approval');
			}

			return toNormalizedBN(approval.context.allowance, request.current.inputToken.decimals);
		} catch (error) {
			console.error(error);
			return ({raw: Zero, normalized: 0});
		}

	}, [getApproval, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an signature to approve the token to be used by the Portals
	** solver. A single signature is required, which will allow the spending
	** of the token by the Portals solver.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = ethers.constants.MaxUint256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!latestQuote?.current || !request?.current || isSolverDisabled[Solver.PORTALS]) {
			return;
		}

		try {
			const approval = await getApproval({
				network: safeChainID,
				params: {
					takerAddress: toAddress(request.current.from),
					sellToken: toAddress(request.current.inputToken.value),
					sellAmount:formatBN(request.current.inputAmount || 0).toString(),
					buyToken: toAddress(request.current.outputToken.value)
				}
			});

			if (!approval) {
				throw new Error('Fail to get approval');
			}

			const isApproved = await isApprovedERC20(
				provider,
				toAddress(request.current.inputToken.value), //token to approve
				toAddress(approval.context.spender), //contract to approve
				amount
			);

			if (!isApproved) {
				new Transaction(provider, approveERC20, txStatusSetter)
					.populate(
						toAddress(request.current.inputToken.value), //token to approve
						toAddress(approval.context.spender), //contract to approve
						amount
					)
					.onSuccess(onSuccess)
					.perform();
			}
			onSuccess();
			return;
		} catch (error) {
			console.error(error);
			return;
		}
	}, [getApproval, provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** This execute function is not an actual deposit/withdraw, but a swap using
	** the Portals solver. The deposit will be executed by the Portals solver by
	** simply swapping the input token for the output token.
	**************************************************************************/
	const onExecute = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		new Transaction(provider, execute, txStatusSetter)
			.populate()
			.onSuccess(onSuccess)
			.perform();
	}, [execute, provider]);
	return useMemo((): TSolverContext => ({
		type: Solver.PORTALS,
		quote: expectedOut,
		getQuote,
		refreshQuote,
		init,
		onRetrieveExpectedOut,
		onRetrieveAllowance,
		onApprove,
		onExecuteDeposit: onExecute,
		onExecuteWithdraw: onExecute
	}), [expectedOut, getQuote, refreshQuote, init, onApprove, onExecute, onRetrieveAllowance, onRetrieveExpectedOut]);
}

