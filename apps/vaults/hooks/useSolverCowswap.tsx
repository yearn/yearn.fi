import {useCallback, useMemo, useRef} from 'react';
import {ethers, formatUnits, parseUnits} from 'ethers';
import axios from 'axios';
import useSWRMutation from 'swr/mutation';
import {domain, OrderKind, SigningScheme, signOrder} from '@cowprotocol/contracts';
import {isSolverDisabled, Solver} from '@vaults/contexts/useSolver';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {SOLVER_COW_VAULT_RELAYER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {MaxUint256, toBigInt, toNormalizedBN, toNumber} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useYearn} from '@common/contexts/useYearn';
import {approvedERC20Amount, approveERC20, isApprovedERC20} from '@common/utils/actions/approveToken';

import type {AxiosError} from 'axios';
import type {MayPromise, TNormalizedBN} from '@yearn-finance/web-lib/types';
import type {TTxResponse, TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {ApiError, Order, QuoteQuery, Timestamp} from '@cowprotocol/contracts';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';
import type {TCowAPIResult, TCowResult} from '@vaults/types/solvers.cowswap';

function useCowswapQuote(): [TCowResult, (request: TInitSolverArgs, shouldPreventErrorToast?: boolean) => MayPromise<TCowAPIResult>] {
	const {toast} = yToast();
	const {data, error, trigger, isMutating} = useSWRMutation(
		'https://api.cow.fi/mainnet/api/v1/quote',
		async (url: string, data: {arg: unknown}): Promise<TCowAPIResult> => {
			const req = await axios.post(url, data.arg);
			return req.data;
		}
	);

	const getQuote = useCallback(async (
		request: TInitSolverArgs,
		shouldPreventErrorToast = false
	): MayPromise<TCowAPIResult> => {
		const	YEARN_APP_DATA = '0x5d22bf49b708de1d2d9547a6cca9faccbdc2b162012e8573811c07103b163d4b';
		const	quote: QuoteQuery = {
			from: request.from, // receiver
			sellToken: toAddress(request.inputToken.value), // token to spend
			buyToken: toAddress(request.outputToken.value), // token to receive
			receiver: request.from, // always the same as from
			appData: YEARN_APP_DATA, // Always this
			kind: OrderKind.SELL, // always sell
			partiallyFillable: false, // always false
			validTo: 0,
			sellAmountBeforeFee: request?.inputAmount.toString() // amount to sell, in wei
		};

		const canExecuteFetch =
			!(isZero(quote.from) || isZero(quote.sellToken) || isZero(quote.buyToken))
			&& !isZero(request?.inputAmount)
		;
		if (canExecuteFetch) {
			quote.validTo = Math.round(new Date().setMinutes(new Date().getMinutes() + 10) / 1000);
			try {
				const result = await trigger(quote, {revalidate: false});
				return result;
			} catch (error) {
				const	_error = error as AxiosError<ApiError>;
				console.error(error);
				if (shouldPreventErrorToast) {
					return undefined;
				}
				const	message = `Zap not possible. Try again later or pick another token. ${_error?.response?.data?.description ? `(Reason: [${_error?.response?.data?.description}])` : ''}`;
				toast({type: 'error', content: message});
				return undefined;
			}
		}
		return undefined;
	}, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

	return [
		useMemo((): TCowResult => ({
			result: data,
			isLoading: isMutating,
			error
		}), [data, error, isMutating]),
		getQuote
	];
}

export function useSolverCowswap(): TSolverContext {
	const {zapSlippage} = useYearn();
	const {address, provider} = useWeb3();
	const maxIterations = 1000; // 1000 * up to 3 seconds = 3000 seconds = 50 minutes
	const shouldUsePresign = false; //Debug only
	const [, getQuote] = useCowswapQuote();
	const request = useRef<TInitSolverArgs>();
	const latestQuote = useRef<TCowAPIResult>();

	/* 🔵 - Yearn Finance **************************************************************************
	** A slippage of 1% per default is set to avoid the transaction to fail due to price
	** fluctuations. The buyAmountWithSlippage is used to request this amount instead of the
	** original buyAmount.
	**********************************************************************************************/
	const getBuyAmountWithSlippage = useCallback((currentQuote: TCowAPIResult, decimals: bigint): string => {
		if (!currentQuote) {
			return '0';
		}
		const {quote} = currentQuote;
		const buyAmount = toNumber(formatUnits(quote.buyAmount.toString(), decimals));
		const withSlippage = parseUnits((buyAmount * (1 - toNumber(zapSlippage / 100))).toFixed(Number(decimals)), decimals);
		return withSlippage.toString();
	}, [zapSlippage]);

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.current.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN> => {
		if (isSolverDisabled[Solver.COWSWAP]) {
			return toNormalizedBN(0);
		}
		request.current = _request;
		const quote = await getQuote(_request);
		if (quote) {
			latestQuote.current = quote;
			getBuyAmountWithSlippage(quote, toBigInt(request?.current?.outputToken?.decimals || 18));
			return toNormalizedBN(toBigInt(quote?.quote?.buyAmount.toString()), toBigInt(request?.current?.outputToken?.decimals));
		}
		return toNormalizedBN(0);
	}, [getBuyAmountWithSlippage, getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** signCowswapOrder is used to sign the order with the user's wallet. The signature is used
	** to execute the order.
	** If shouldUsePresign is set to true, the signature is not required and the approval is
	** skipped. This should only be used for debugging purposes.
	**********************************************************************************************/
	const	signCowswapOrder = useCallback(async (quote: Order): Promise<string> => {
		if (shouldUsePresign) {
			return toAddress(address || '');
		}

		const	signer = await provider.getSigner() as any;
		const	rawSignature = await signOrder(
			domain(1, '0x9008D19f58AAbD9eD0D60971565AA8510560ab41'),
			quote,
			signer,
			SigningScheme.EIP712
		);
		return ethers.Signature.from(rawSignature.data as ethers.SignatureLike).serialized;
	}, [provider, shouldUsePresign, address]);

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
	** Cowswap orders have a validity period and the return value on submit is not the execution
	** status of the order. This method is used to check the status of the order and returns a
	** boolean value indicating whether the order was successful or not.
	** It will timeout once the order is no longer valid or after 50 minutes (max should be 30mn)
	**********************************************************************************************/
	async function checkOrderStatus(orderUID: string, validTo: Timestamp): Promise<{isSuccessful: boolean, error?: Error}> {
		for (let i = 0; i < maxIterations; i++) {
			const {data: order} = await axios.get(`https://api.cow.fi/mainnet/api/v1/orders/${orderUID}`);
			if (order?.status === 'fulfilled') {
				return {isSuccessful: true};
			}
			if (order?.status === 'cancelled' || order?.status === 'expired') {
				return {isSuccessful: false, error: new Error('TX fail because the order was not fulfilled')};
			}
			if (validTo < new Date().valueOf() / 1000) {
				return {isSuccessful: false, error: new Error('TX fail because the order expired')};
			}
			// Sleep for 3 seconds before checking the status again
			await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 3000));
		}
		return {isSuccessful: false, error: new Error('TX fail because the order expired')};
	}

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (): Promise<TTxResponse> => {
		if (!latestQuote?.current || !latestQuote?.current?.quote || !request.current || isSolverDisabled[Solver.COWSWAP]) {
			return {isSuccessful: false};
		}
		const	{quote, from, id} = latestQuote.current;
		try {
			const	buyAmountWithSlippage = getBuyAmountWithSlippage(latestQuote.current, request.current.outputToken.decimals);
			const	signature = await signCowswapOrder({...quote, buyAmount: buyAmountWithSlippage});
			const	{data: orderUID} = await axios.post('https://api.cow.fi/mainnet/api/v1/orders', {
				...quote,
				buyAmount: buyAmountWithSlippage,
				from: from,
				quoteId: id,
				signature: signature,
				signingScheme: shouldUsePresign ? 'presign' : 'eip712'
			});
			if (orderUID) {
				const {isSuccessful, error} = await checkOrderStatus(orderUID, quote.validTo);
				if (error) {
					console.error(error);
					return {isSuccessful: false, error};
				}
				return {isSuccessful};
			}
		} catch (error) {
			console.error(error);
			return {isSuccessful: false, error: error as Error};
		}
		return {isSuccessful: false};
	}, [getBuyAmountWithSlippage, shouldUsePresign, signCowswapOrder]);

	/* 🔵 - Yearn Finance ******************************************************
	** Format the quote to a normalized value, which will be used for subsequent
	** process and displayed to the user.
	**************************************************************************/
	const expectedOut = useMemo((): TNormalizedBN => {
		if (!latestQuote?.current?.quote?.buyAmount || isSolverDisabled[Solver.COWSWAP]) {
			return toNormalizedBN(0);
		}
		return toNormalizedBN(latestQuote?.current?.quote?.buyAmount.toString(), toBigInt(request?.current?.outputToken?.decimals));
	}, [latestQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the current outValue from the quote, which will be used to
	** display the current value to the user.
	**************************************************************************/
	const onRetrieveExpectedOut = useCallback(async (request: TInitSolverArgs): Promise<TNormalizedBN> => {
		if (isSolverDisabled[Solver.COWSWAP]) {
			return toNormalizedBN(0);
		}
		const quoteResult = await getQuote(request, true);
		return toNormalizedBN(toBigInt(quoteResult?.quote?.buyAmount.toString()), request.outputToken.decimals);
	}, [getQuote]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the allowance for the token to be used by the solver. This will
	** be used to determine if the user should approve the token or not.
	**************************************************************************/
	const onRetrieveAllowance = useCallback(async (): Promise<TNormalizedBN> => {
		if (!request?.current || isSolverDisabled[Solver.COWSWAP]) {
			return toNormalizedBN(0);
		}

		const allowance = await approvedERC20Amount(
			provider,
			toAddress(request.current.inputToken.value), //Input token
			toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS) //Spender, aka Cowswap solver
		);
		return toNormalizedBN(allowance, request.current.inputToken.decimals);
	}, [provider, request]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an signature to approve the token to be used by the Cowswap
	** solver. A single signature is required, which will allow the spending
	** of the token by the Cowswap solver.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = MaxUint256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (!latestQuote?.current || !latestQuote?.current?.quote || !request?.current || isSolverDisabled[Solver.COWSWAP]) {
			return;
		}

		const	isApproved = await isApprovedERC20(
			provider,
			toAddress(request.current.inputToken.value), //token to approve
			toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //Cowswap relayer
			amount
		);
		if (isApproved) {
			onSuccess();
			return;
		}
		new Transaction(provider, approveERC20, txStatusSetter)
			.populate(
				toAddress(request.current.inputToken.value), //token to approve
				toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //Cowswap relayer
				amount
			)
			.onSuccess(onSuccess)
			.perform();
	}, [provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** This execute function is not an actual deposit, but a swap using the
	** Cowswap solver. The deposit will be executed by the Cowswap solver by
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
	** Cowswap solver. The withdraw will be executed by the Cowswap solver by
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
		type: Solver.COWSWAP,
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
