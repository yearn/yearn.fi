import {useCallback, useMemo, useRef, useState} from 'react';
import {ethers} from 'ethers';
import {getTokenAllowance as wiGetTokenAllowance, getWidoContractAddress, quote as wiQuote} from 'wido';
import {useAsync} from '@vaults/hooks/useAsync';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {approveERC20, isApprovedERC20} from '@common/utils/actions/approveToken';

import type {AxiosError} from 'axios';
import type {QuoteRequest, QuoteResult} from 'wido';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {ApiError} from '@gnosis.pm/gp-v2-contracts';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';
import type {TWidoResult} from '@vaults/types/solvers.wido';

function useWidoQuote(): [TWidoResult, (request: TInitSolverArgs) => Promise<QuoteResult | undefined>] {
	const {toast} = yToast();
	const [err, set_err] = useState<Error>();

	const getQuote = useCallback(async (request: TInitSolverArgs): Promise<QuoteResult | undefined> => {
		const	quoteRequest: QuoteRequest = ({
			fromChainId: 1, // Chain Id of from token
			fromToken: toAddress(request.inputToken.value), // token to spend
			toChainId: 1, // Chain Id of to token
			toToken: toAddress(request.outputToken.value), // token to receive
			amount: formatBN(request?.inputAmount || 0).toString(), // Token amount of from token
			slippagePercentage: 0.1, // Acceptable max slippage for the swap
			user: request.from // receiver
		});

		const canExecuteFetch = (
			!(isZeroAddress(quoteRequest.user) || isZeroAddress(quoteRequest.fromToken) || isZeroAddress(quoteRequest.toToken))
			&& !formatBN(request?.inputAmount || 0).isZero()
		);

		if (canExecuteFetch) {
			try {
				const result = await wiQuote(quoteRequest);

				return result;
			} catch (error) {
				const	_error = error as AxiosError<ApiError>;
				set_err(error as Error);
				console.error(error);
				const	message = `Zap not possible. Try again later or pick another token. ${_error?.response?.data?.description ? `(Reason: [${_error?.response?.data?.description}])` : ''}`;
				toast({type: 'error', content: message});
				return undefined;
			}
		}
		return undefined;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const [data, isLoading] = useAsync<QuoteResult>(getQuote, undefined, []);


	return [
		useMemo((): TWidoResult => ({
			result: data,
			isLoading,
			error: err
		}), [data, err, isLoading]),
		getQuote
	];
}

export function useSolverWido(): TSolverContext {
	const {provider} = useWeb3();
	const [, getQuote] = useWidoQuote();
	const request = useRef<TInitSolverArgs>();
	const latestQuote = useRef<QuoteResult>();

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the Wido solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.current.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN> => {
		request.current = _request;
		const quote = await getQuote(_request);
		if (quote) {
			latestQuote.current = quote;
			return toNormalizedBN(formatBN(quote?.toTokenAmount));
		}
		return toNormalizedBN(0);
	}, [getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** refreshQuote can be called by the user to refresh the quote. The same parameters are used
	** as in the initial request and it will fails if request is not set.
	** init should be called first to initialize the request.current.
	**********************************************************************************************/
	const	refreshQuote = useCallback(async (): Promise<void> => {
		if (request.current) {
			getQuote(request.current);
		}
	}, [request, getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (): Promise<boolean> => {
		if (!latestQuote?.current || !request.current) {
			return false;
		}

		const signer = (provider as ethers.providers.Web3Provider).getSigner();
		try {
			const {data, to} = latestQuote.current;
			const transaction = await signer.sendTransaction({data, to});
			const transactionResult = await transaction.wait();
			if (transactionResult.status === 0) {
				console.error('Fail to perform transaction');
				return false;
			}
			return true;
		} catch (_error) {
			console.error(_error);
			return false;
		}
	}, [provider, latestQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Format the quote to a normalized value, which will be used for subsequent
	** process and displayed to the user.
	**************************************************************************/
	const expectedOut = useMemo((): TNormalizedBN => {
		if (!latestQuote?.current?.toTokenAmount) {
			return (toNormalizedBN(0));
		}
		return toNormalizedBN(latestQuote?.current?.toTokenAmount, request?.current?.outputToken?.decimals || 18);
	}, [latestQuote, request]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the current outValue from the quote, which will be used to
	** display the current value to the user.
	**************************************************************************/
	const onRetrieveExpectedOut = useCallback(async (request: TInitSolverArgs): Promise<TNormalizedBN> => {
		const	quoteResult = await getQuote(request);
		return toNormalizedBN(formatBN(quoteResult?.toTokenAmount), request.outputToken.decimals);
	}, [getQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the allowance for the token to be used by the solver. This will
	** be used to determine if the user should approve the token or not.
	**************************************************************************/
	const onRetrieveAllowance = useCallback(async (): Promise<TNormalizedBN> => {
		if (!latestQuote?.current || !request?.current) {
			return toNormalizedBN(0);
		}

		const {allowance} = await wiGetTokenAllowance({
			chainId: 1,
			tokenAddress: toAddress(request.current.inputToken.value),
			accountAddress: toAddress(request.current.from)
		});
		return toNormalizedBN(allowance, request.current.inputToken.decimals);
	}, [latestQuote, request]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an signature to approve the token to be used by the Wido
	** solver. A single signature is required, which will allow the spending
	** of the token by the Wido solver.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = ethers.constants.MaxUint256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!latestQuote?.current || !request?.current) {
			return;
		}
		const	widoRelayerAddress = toAddress(await getWidoContractAddress(1));
		const	isApproved = await isApprovedERC20(
			provider as ethers.providers.Web3Provider,
			toAddress(request.current.inputToken.value), //token to approve
			widoRelayerAddress, //Wido relayer
			amount
		);
		if (!isApproved) {
			new Transaction(provider, approveERC20, txStatusSetter)
				.populate(
					toAddress(request.current.inputToken.value), //token to approve
					widoRelayerAddress, //Wido relayer
					amount
				)
				.onSuccess(onSuccess)
				.perform();
		}
		onSuccess();
		return;
	}, [provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** This execute function is not an actual deposit, but a swap using the
	** Wido solver. The deposit will be executed by the Wido solver by
	** simply swapping the input token for the output token.
	**************************************************************************/
	const onExecuteDeposit = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		new Transaction(provider, execute, txStatusSetter)
			.populate()
			.onSuccess(onSuccess)
			.perform();
	}, [execute, provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** This execute function is not an actual withdraw, but a swap using the
	** Wido solver. The withdraw will be executed by the Wido solver by
	** simply swapping the input token for the output token.
	**************************************************************************/
	const onExecuteWithdraw = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		new Transaction(provider, execute, txStatusSetter)
			.populate()
			.onSuccess(onSuccess)
			.perform();
	}, [execute, provider]);


	return useMemo((): TSolverContext => ({
		quote: expectedOut,
		getQuote: getQuote,
		refreshQuote,
		init,
		onRetrieveExpectedOut,
		onRetrieveAllowance,
		onApprove,
		onExecuteDeposit,
		onExecuteWithdraw
	}), [expectedOut, getQuote, refreshQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance, onRetrieveExpectedOut]);
}
