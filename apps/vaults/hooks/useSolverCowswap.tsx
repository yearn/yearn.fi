import {useCallback, useMemo, useRef, useState} from 'react';
import {ethers} from 'ethers';
import axios from 'axios';
import useSWRMutation from 'swr/mutation';
import {domain, OrderKind, SigningScheme, signOrder} from '@gnosis.pm/gp-v2-contracts';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {DefaultTNormalizedBN} from '@common/utils';

import type {AxiosError} from 'axios';
import type {BigNumber} from 'ethers';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {ApiError, Order, QuoteQuery, Timestamp} from '@gnosis.pm/gp-v2-contracts';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';
import type {TCowAPIResult, TCowResult} from '@vaults/types/solvers.cowswap';

function useCowswapQuote(): [TCowResult, (request: TInitSolverArgs) => Promise<Order | undefined>] {
	const 	{toast} = yToast();
	const {data, error, trigger, isMutating} = useSWRMutation(
		'https://api.cow.fi/mainnet/api/v1/quote',
		async (url: string, data: {arg: unknown}): Promise<TCowAPIResult> => {
			const req = await axios.post(url, data.arg);
			return req.data;
		}
	);

	const getQuote = useCallback(async (request: TInitSolverArgs): Promise<Order | undefined> => {
		const	YEARN_APP_DATA = '0x2B8694ED30082129598720860E8E972F07AA10D9B81CAE16CA0E2CFB24743E24';
		const	quote: QuoteQuery = ({
			from: request.from, // receiver
			sellToken: toAddress(request.inputToken.value), // token to spend
			buyToken: toAddress(request.outputToken.value), // token to receive
			receiver: request.from, // always the same as from
			appData: YEARN_APP_DATA, // Always this
			kind: OrderKind.SELL, // always sell
			partiallyFillable: false, // always false
			validTo: 0,
			sellAmountBeforeFee: formatBN(request?.inputAmount || 0).toString() // amount to sell, in wei
		});

		const canExecuteFetch = (
			!(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken) || isZeroAddress(quote.buyToken))
			&& !formatBN(request?.inputAmount || 0).isZero()
		);
		if (canExecuteFetch) {
			quote.validTo = Math.round((new Date().setMinutes(new Date().getMinutes() + 10) / 1000));
			try {
				const result = await trigger(quote, {revalidate: false});
				return (result?.quote);
			} catch (error) {
				const	_error = error as AxiosError<ApiError>;
				toast({type: 'error', content: _error?.response?.data?.description || 'Error while fetching quote from Cowswap'});
				return undefined;
			}
		}
		return undefined;
	}, [trigger]);

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
	const {provider} = useWeb3();
	const shouldUsePresign = false; //Debug only
	const DEFAULT_SLIPPAGE_COWSWAP = 0.01; // 1%
	const [latestQuote, getQuote] = useCowswapQuote();
	const [signature, set_signature] = useState<string>('');
	const request = useRef<TInitSolverArgs>();

	/* 🔵 - Yearn Finance **************************************************************************
	** A slippage of 1% per default is set to avoid the transaction to fail due to price
	** fluctuations. The buyAmountWithSlippage is used to request this amount instead of the
	** original buyAmount.
	**********************************************************************************************/
	const buyAmountWithSlippage = useMemo((): BigNumber => {
		if (latestQuote?.result === undefined || latestQuote?.result?.quote === undefined || !request?.current?.outputToken?.decimals) {
			return formatBN(0);
		}
		const	{quote} = latestQuote.result;
		const	buyAmount = Number(ethers.utils.formatUnits(quote.buyAmount, request.current.outputToken.decimals));
		const	withSlippage = ethers.utils.parseUnits((buyAmount * (1 - Number(DEFAULT_SLIPPAGE_COWSWAP))).toFixed(request.current.outputToken.decimals), request.current.outputToken.decimals);
		return withSlippage;
	}, [latestQuote.result]);

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.current.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN> => {
		request.current = _request;
		const quote = await getQuote(_request);
		return ({
			raw: formatBN(quote?.buyAmount || ethers.constants.Zero),
			normalized: formatToNormalizedValue(formatBN(quote?.buyAmount || 0), request?.current?.outputToken?.decimals || 18)
		});
	}, [getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** signCowswapOrder is used to sign the order with the user's wallet. The signature is used
	** to execute the order.
	** If shouldUsePresign is set to true, the signature is not required and the approval is
	** skipped. This should only be used for debugging purposes.
	**********************************************************************************************/
	const	signCowswapOrder = useCallback(async (quote: Order): Promise<string> => {
		if (shouldUsePresign) {
			return toAddress(latestQuote?.result?.from);
		}

		const	signer = (provider as ethers.providers.Web3Provider).getSigner();
		const	rawSignature = await signOrder(
			domain(1, '0x9008D19f58AAbD9eD0D60971565AA8510560ab41'),
			quote,
			signer,
			SigningScheme.EIP712
		);
		const signature = ethers.utils.joinSignature(rawSignature.data);
		return signature;
	}, [latestQuote?.result?.from, provider, shouldUsePresign]);

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
	** approve is a method that approves an order for the CowSwap exchange. It returns a boolean
	** value indicating whether the approval was successful or not.
	** This method tries to sign the quote object contained within the latestQuote.result object using
	** the signCowswapOrder method described above. The buyAmount field of the quote object is set
	** to the value of the buyAmountWithSlippage variable before it is passed to the
	** signCowswapOrder method.
	**********************************************************************************************/
	const	approve = useCallback(async (): Promise<boolean> => {
		if (latestQuote?.result === undefined || latestQuote?.result?.quote === undefined) {
			return false;
		}

		const	{quote} = latestQuote.result;
		try {
			const	signature = await signCowswapOrder({
				...quote,
				buyAmount: buyAmountWithSlippage.toString()
			});
			set_signature(signature);
			return true;
		} catch (_error) {
			console.error(_error);
			return false;
		}
	}, [latestQuote.result, signCowswapOrder, buyAmountWithSlippage]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Cowswap orders have a validity period and the return value on submit is not the execution
	** status of the order. This method is used to check the status of the order and returns a
	** boolean value indicating whether the order was successful or not.
	** It will timeout once the order is no longer valid or after 50 minutes (max should be 30mn)
	**********************************************************************************************/
	async function checkOrderStatus(orderUID: string, validTo: Timestamp): Promise<{isSuccessful: boolean, error: Error | undefined}> {
		const	maxIterations = 1000; // 1000 * up to 3 seconds = 3000 seconds = 50 minutes
		for (let i = 0; i < maxIterations; i++) {
			const {data: order} = await axios.get(`https://api.cow.fi/mainnet/api/v1/orders/${orderUID}`);
			if (order?.status === 'fulfilled') {
				return ({isSuccessful: true, error: undefined});
			} else if (order?.status === 'cancelled' || order?.status === 'expired') {
				return ({isSuccessful: false, error: new Error('TX fail because the order was not fulfilled')});
			}
			if (validTo < (new Date().valueOf() / 1000)) {
				return ({isSuccessful: false, error: new Error('TX fail because the order expired')});
			}
			// Sleep for 3 seconds before checking the status again
			await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 3000));
		}
		return ({isSuccessful: false, error: new Error('TX fail because the order expired')});
	} 

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (): Promise<boolean> => {
		if (latestQuote?.result === undefined || latestQuote?.result?.quote === undefined) {
			return false;
		}
		const	{quote, from, id} = latestQuote.result;
		try {
			const	{data: orderUID} = await axios.post('https://api.cow.fi/mainnet/api/v1/orders', {
				...quote,
				buyAmount: buyAmountWithSlippage.toString(),
				from: from,
				quoteId: id,
				signature: signature,
				signingScheme: String(shouldUsePresign ? 'presign' : 'eip712')
			});
			if (orderUID) {
				const {isSuccessful, error} = await checkOrderStatus(orderUID, quote.validTo);
				if (error) {
					console.error(error);
				}
				return isSuccessful;
			}
		} catch (_error) {
			console.error(_error);
			return false;
		}
		return false;
	}, [buyAmountWithSlippage, latestQuote.result, shouldUsePresign, signature]);

	const expectedOut = useMemo((): TNormalizedBN => {
		if (!latestQuote?.result?.quote?.buyAmount) {
			return (DefaultTNormalizedBN);
		}
		return ({
			raw: formatBN(latestQuote?.result?.quote?.buyAmount || ethers.constants.Zero),
			normalized: formatToNormalizedValue(formatBN(latestQuote?.result?.quote?.buyAmount || 0), request?.current?.outputToken?.decimals || 18)
		});
	}, [latestQuote?.result?.quote?.buyAmount]);


	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an signature to approve the token to be used by the Cowswap
	** solver. A single signature is required, which will allow the spending
	** of the token by the Cowswap solver.
	**************************************************************************/
	const onApprove = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		new Transaction(provider, approve, txStatusSetter)
			.populate()
			.onSuccess(onSuccess)
			.perform();
	}, [approve, provider]);

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
		quote: expectedOut,
		getQuote: getQuote,
		refreshQuote,
		init,
		onApprove: onApprove,
		onExecuteDeposit: onExecuteDeposit,
		onExecuteWithdraw: onExecuteWithdraw
	}), [expectedOut, getQuote, refreshQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw]);
}
