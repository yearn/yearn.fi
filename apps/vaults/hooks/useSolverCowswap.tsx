import {useCallback, useMemo, useState} from 'react';
import {BigNumber, ethers} from 'ethers';
import axios from 'axios';
import useSWRMutation from 'swr/mutation';
import {domain, OrderKind, SigningScheme, signOrder} from '@gnosis.pm/gp-v2-contracts';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {Order, QuoteQuery, Timestamp} from '@gnosis.pm/gp-v2-contracts';
import type {TCowAPIResult, TCowRequest, TCowResult, TCowswapSolverContext} from '@vaults/types/solvers.cow';

function useCowswapQuote(): [TCowResult, (request: TCowRequest) => Promise<void>] {
	const fetchCowQuote = useCallback(async(url: string, data: {arg: unknown}): Promise<TCowAPIResult> => {
		return (await axios.post(url, data.arg)).data;
	}, []);

	const {data, error, trigger, isMutating} = useSWRMutation('https://api.cow.fi/mainnet/api/v1/quote', fetchCowQuote);

	const getQuote = useCallback(async (request: TCowRequest): Promise<void> => {
		const	YEARN_APP_DATA = '0x2B8694ED30082129598720860E8E972F07AA10D9B81CAE16CA0E2CFB24743E24';
		const	quote: QuoteQuery = ({
			from: request.from, // receiver
			sellToken: request.sellToken, // token to spend
			buyToken: request.buyToken, // token to receive
			receiver: request.from, // always the same as from
			appData: YEARN_APP_DATA, // Always this
			kind: OrderKind.SELL, // always sell
			partiallyFillable: false, // always false
			validTo: 0,
			sellAmountBeforeFee: formatBN(request?.sellAmount || 0).toString() // amount to sell, in wei
		});

		const canExecuteFetch = !(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken) || isZeroAddress(quote.buyToken)) && !formatBN(request?.sellAmount || 0).isZero();
		console.warn({canExecuteFetch});
		if (canExecuteFetch) {
			quote.validTo = Math.round((new Date().setMinutes(new Date().getMinutes() + 10) / 1000));
			trigger(quote, {revalidate: false});
		}
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

export function useSolverCowswap(): TCowswapSolverContext {
	const {provider} = useWeb3();
	const shouldUsePresign = false; //Debug only
	const DEFAULT_SLIPPAGE_COWSWAP = 0.01; // 1%
	const [request, set_request] = useState<TCowRequest>();
	const [cowQuote, getQuote] = useCowswapQuote();
	const [signature, set_signature] = useState<string>('');

	/* 🔵 - Yearn Finance **************************************************************************
	** A slippage of 1% per default is set to avoid the transaction to fail due to price
	** fluctuations. The buyAmountWithSlippage is used to request this amount instead of the
	** original buyAmount.
	**********************************************************************************************/
	const buyAmountWithSlippage = useMemo((): BigNumber => {
		if (cowQuote?.result === undefined || cowQuote?.result?.quote === undefined || !request?.buyTokenDecimals) {
			return formatBN(0);
		}
		const	{quote} = cowQuote.result;
		const	buyAmount = Number(ethers.utils.formatUnits(quote.buyAmount, request.buyTokenDecimals));
		const	withSlippage = ethers.utils.parseUnits((buyAmount * (1 - Number(DEFAULT_SLIPPAGE_COWSWAP))).toFixed(request.buyTokenDecimals), request.buyTokenDecimals);
		return withSlippage;
	}, [cowQuote.result, request?.buyTokenDecimals]);

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.
	**********************************************************************************************/
	const init = useCallback(async (_request: TCowRequest): Promise<void> => {
		set_request(_request);
		getQuote(_request);
	}, [getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** signCowswapOrder is used to sign the order with the user's wallet. The signature is used
	** to execute the order.
	** If shouldUsePresign is set to true, the signature is not required and the approval is
	** skipped. This should only be used for debugging purposes.
	**********************************************************************************************/
	const	signCowswapOrder = useCallback(async (quote: Order): Promise<string> => {
		if (shouldUsePresign) {
			return toAddress(cowQuote?.result?.from);
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
	}, [cowQuote?.result?.from, provider, shouldUsePresign]);

	/* 🔵 - Yearn Finance **************************************************************************
	** refreshQuote can be called by the user to refresh the quote. The same parameters are used
	** as in the initial request and it will fails if request is not set.
	** init should be called first to initialize the request.
	**********************************************************************************************/
	const	refreshQuote = useCallback(async (): Promise<void> => {
		if (!request) {
			return;
		}
		getQuote({
			from: toAddress(cowQuote?.result?.from),
			sellToken: toAddress(cowQuote.result?.quote.sellToken),
			buyToken: toAddress(cowQuote.result?.quote.buyToken),
			sellAmount: BigNumber.from(cowQuote.result?.quote.sellAmount),
			sellTokenDecimals: request?.sellTokenDecimals,
			buyTokenDecimals: request?.buyTokenDecimals
		});
	}, [request, getQuote, cowQuote.result?.from, cowQuote.result?.quote.sellToken, cowQuote.result?.quote.buyToken, cowQuote.result?.quote.sellAmount]);

	/* 🔵 - Yearn Finance **************************************************************************
	** approve is a method that approves an order for the CowSwap exchange. It returns a boolean
	** value indicating whether the approval was successful or not.
	** This method tries to sign the quote object contained within the cowQuote.result object using
	** the signCowswapOrder method described above. The buyAmount field of the quote object is set
	** to the value of the buyAmountWithSlippage variable before it is passed to the
	** signCowswapOrder method.
	**********************************************************************************************/
	const	approve = useCallback(async (): Promise<boolean> => {
		if (cowQuote?.result === undefined || cowQuote?.result?.quote === undefined) {
			return false;
		}

		const	{quote} = cowQuote.result;
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
	}, [cowQuote.result, signCowswapOrder, buyAmountWithSlippage]);

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
		if (cowQuote?.result === undefined || cowQuote?.result?.quote === undefined) {
			return false;
		}
		const	{quote, from, id} = cowQuote.result;
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
	}, [buyAmountWithSlippage, cowQuote.result, shouldUsePresign, signature]);

	return useMemo((): TCowswapSolverContext => ({
		quote: cowQuote,
		getQuote: getQuote,
		refreshQuote,
		init,
		approve,
		execute
	}), [approve, cowQuote, getQuote, refreshQuote, execute, init]);
}
