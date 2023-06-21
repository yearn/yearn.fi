import {useCallback, useMemo, useRef} from 'react';
import {isHex} from 'viem';
import {getWidoSpender, quote as wiQuote} from 'wido';
import {captureException} from '@sentry/nextjs';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import {getNetwork, waitForTransaction} from '@wagmi/core';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isEth} from '@yearn-finance/web-lib/utils/isEth';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useYearn} from '@common/contexts/useYearn';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {allowanceOf, approveERC20, isApprovedERC20} from '@common/utils/actions';
import {assert} from '@common/utils/assert';
import {assertAddress, toWagmiProvider} from '@common/utils/toWagmiProvider';

import type {BaseError} from 'viem';
import type {ChainId, QuoteRequest, QuoteResult} from 'wido';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TTxResponse, TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

async function getQuote(
	request: TInitSolverArgs,
	currentPartner: TAddress,
	safeChainID: number,
	zapSlippage: number
): Promise<{data: QuoteResult | undefined, error: Error | undefined}> {
	const params: QuoteRequest = ({
		fromChainId: safeChainID as ChainId, // Chain Id of from token
		fromToken: toAddress(request.inputToken.value), // token to spend
		toChainId: safeChainID as ChainId, // Chain Id of to token
		toToken: toAddress(request.outputToken.value), // token to receive
		amount: toBigInt(request?.inputAmount).toString(), // Token amount of from token
		slippagePercentage: zapSlippage / 100, // Acceptable max slippage for the swap
		user: request.from, // receiver
		partner: currentPartner
	});

	if (isZeroAddress(params.user)) {
		return {data: undefined, error: new Error('Invalid user')};
	}
	if (isZeroAddress(params.fromToken)) {
		return {data: undefined, error: new Error('Invalid from token')};
	}
	if (isZeroAddress(params.toToken)) {
		return {data: undefined, error: new Error('Invalid to token')};
	}
	if (isZero(params.amount)) {
		return {data: undefined, error: new Error('Invalid amount')};
	}

	try {
		const result = await wiQuote(params);
		return {data: result, error: undefined};
	} catch (error) {
		return {data: undefined, error: error as Error};
	}
}

export function useSolverWido(): TSolverContext {
	const {provider} = useWeb3();
	const request = useRef<TInitSolverArgs>();
	const latestQuote = useRef<QuoteResult>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});
	const {safeChainID} = useChainID();
	const {zapSlippage, currentPartner} = useYearn();

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the Wido solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.current.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs, shouldLogError?: boolean): Promise<TNormalizedBN> => {
		/******************************************************************************************
		** First we need to know which token we are selling to the zap. When we are depositing, we
		** are selling the inputToken, when we are withdrawing, we are selling the outputToken.
		** based on that token, different checks are required to determine if the solver can be
		** used.
		******************************************************************************************/
		const sellToken = _request.isDepositing ? _request.inputToken: _request.outputToken;

		/******************************************************************************************
		** This first obvious check is to see if the solver is disabled. If it is, we return 0.
		******************************************************************************************/
		if (isSolverDisabled[Solver.enum.Wido]) {
			return toNormalizedBN(0);
		}

		/******************************************************************************************
		** Then, we check if the solver can be used for this specific sellToken. If it can't, we
		** return 0.
		** This solveVia array is set via the yDaemon tokenList process. If a solve is not set for
		** a token, you can contact the yDaemon team to add it.
		******************************************************************************************/
		if (!sellToken.solveVia?.includes(Solver.enum.Wido)) {
			return toNormalizedBN(0);
		}

		/******************************************************************************************
		** At this point, we know that the solver can be used for this specific token. We set the
		** request to the provided value, as it's required to get the quote, and we call getQuote
		** to get the current quote for the provided request.current.
		******************************************************************************************/
		request.current = _request;
		const {data, error} = await getQuote(_request, currentPartner, safeChainID, zapSlippage);
		if (!data) {
			if (error && !shouldLogError) {
				toast({type: 'error', content: 'Zap not possible. Try again later or pick another token.'});
			}
			return toNormalizedBN(0);
		}
		latestQuote.current = data;
		return toNormalizedBN(data?.minToTokenAmount || 0, request?.current?.outputToken?.decimals || 18);
	}, [currentPartner, safeChainID, zapSlippage]);

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (): Promise<TTxResponse> => {
		if (isSolverDisabled[Solver.enum.Wido]) {
			return ({isSuccessful: false});
		}

		assert(provider, 'Provider is not set');
		assert(request.current, 'Request is not set');
		assert(latestQuote.current, 'Quote is not set');

		try {
			const wagmiProvider = await toWagmiProvider(provider);
			const {data, to, value} = latestQuote.current;

			assert(isHex(data), 'Data is not hex');
			assert(wagmiProvider.walletClient, 'Wallet client is not set');

			const {chain} = getNetwork();
			const hash = await wagmiProvider.walletClient.sendTransaction({
				...wagmiProvider,
				chain: chain,
				data: data,
				to: toAddress(to),
				value: toBigInt(value)
			});
			const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
			if (receipt.status === 'success') {
				return ({isSuccessful: true, receipt: receipt});
			}
			return ({isSuccessful: false});
		} catch (_error) {
			console.error(_error);
			return ({isSuccessful: false, error: _error as BaseError});
		}
	}, [provider, latestQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Format the quote to a normalized value, which will be used for subsequent
	** process and displayed to the user.
	**************************************************************************/
	const expectedOut = useMemo((): TNormalizedBN => {
		if (!latestQuote?.current?.minToTokenAmount || isSolverDisabled[Solver.enum.Wido]) {
			return (toNormalizedBN(0));
		}
		return toNormalizedBN(latestQuote?.current?.minToTokenAmount, request?.current?.outputToken?.decimals || 18);
	}, [latestQuote, request]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the allowance for the token to be used by the solver. This will
	** be used to determine if the user should approve the token or not.
	**************************************************************************/
	const onRetrieveAllowance = useCallback(async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
		if (!latestQuote?.current || !request?.current || isSolverDisabled[Solver.enum.Wido]) {
			return toNormalizedBN(0);
		}

		if (isEth(toAddress(request.current.inputToken.value))) {
			return toNormalizedBN(MAX_UINT_256);
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

		try {
			const widoSpender = await getWidoSpender({
				chainId: safeChainID as ChainId,
				toChainId: safeChainID as ChainId,
				fromToken: toAddress(request.current.inputToken.value),
				toToken: toAddress(request.current.outputToken.value)
			});

			const allowance = await allowanceOf({
				connector: provider,
				tokenAddress: toAddress(request.current.inputToken.value),
				spenderAddress: toAddress(widoSpender)
			});

			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
	
			return existingAllowances.current[key];
		} catch (error) {
			console.error(error);
			captureException(error);
		}

		return toNormalizedBN(0);
	}, [provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an signature to approve the token to be used by the Wido
	** solver. A single signature is required, which will allow the spending
	** of the token by the Wido solver.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = MAX_UINT_256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (isSolverDisabled[Solver.enum.Wido]) {
			return;
		}
		assert(request.current, 'Request is not set');
		assert(latestQuote.current, 'Quote is not set');
		assert(request.current.inputToken, 'Input token is not set');
		assert(request.current.inputAmount, 'Input amount is not set');

		const widoSpender = await getWidoSpender({
			chainId: safeChainID as ChainId,
			toChainId: safeChainID as ChainId,
			fromToken: toAddress(request.current.inputToken.value),
			toToken: toAddress(request.current.outputToken.value)
		});
		const isApproved = await isApprovedERC20(
			provider,
			toAddress(request.current.inputToken.value), //token to approve
			toAddress(widoSpender), //contract to approve
			amount
		);
		if (!isApproved) {
			assertAddress(widoSpender, 'spender');
			const result = await approveERC20({
				connector: provider,
				contractAddress: request.current.inputToken.value,
				spenderAddress: widoSpender,
				amount: amount,
				statusHandler: txStatusSetter
			});
			if (result.isSuccessful) {
				onSuccess();
			}
			return;
		}
		onSuccess();
		return;
	}, [provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** This execute function is not an actual deposit, but a swap using the
	** Wido solver. The deposit will be executed by the Wido solver by
	** simply swapping the input token for the output token.
	**************************************************************************/
	const onExecute = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(provider, 'Provider is not set');

		txStatusSetter({...defaultTxStatus, pending: true});
		const status = await execute();
		if (status.isSuccessful) {
			txStatusSetter({...defaultTxStatus, success: true});
			await onSuccess();
		} else {
			txStatusSetter({...defaultTxStatus, error: true});
		}
	}, [execute, provider]);

	return useMemo((): TSolverContext => ({
		type: Solver.enum.Wido,
		quote: expectedOut,
		init,
		onRetrieveAllowance,
		onApprove,
		onExecuteDeposit: onExecute,
		onExecuteWithdraw: onExecute
	}), [expectedOut, init, onApprove, onExecute, onRetrieveAllowance]);
}
