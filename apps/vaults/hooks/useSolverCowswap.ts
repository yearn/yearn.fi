import {useCallback, useMemo, useRef} from 'react';
import {ethers} from 'ethers';
import {BaseError} from 'viem';
import axios from 'axios';
import {OrderBookApi, OrderQuoteSide, OrderSigningUtils} from '@cowprotocol/cow-sdk';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, isZeroAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256, SOLVER_COW_VAULT_RELAYER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isEth} from '@yearn-finance/web-lib/utils/isEth';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useYearn} from '@common/contexts/useYearn';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {allowanceOf, approveERC20, isApprovedERC20} from '@common/utils/actions';
import {assert} from '@common/utils/assert';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TTxResponse, TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {Order, OrderCreation, OrderQuoteResponse, SigningResult, SigningScheme, UnsignedOrder} from '@cowprotocol/cow-sdk';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

const orderBookApi = new OrderBookApi({chainId: 1});

async function getQuote(
	request: TInitSolverArgs
): Promise<{data: OrderQuoteResponse | undefined, error: Error | undefined}> {
	const YEARN_APP_DATA = '0x5d22bf49b708de1d2d9547a6cca9faccbdc2b162012e8573811c07103b163d4b';
	const quoteRequest = {
		from: request.from, // receiver
		sellToken: request.inputToken.value, // token to spend
		buyToken: request.outputToken.value, // token to receive
		receiver: request.from, // always the same as from
		appData: YEARN_APP_DATA, // Always this
		kind: OrderQuoteSide.kind.SELL, // always sell
		partiallyFillable: false, // always false
		validTo: 0,
		sellAmountBeforeFee: toBigInt(request?.inputAmount).toString() // amount to sell, in wei
	};

	if (isZeroAddress(quoteRequest.from)) {
		return {data: undefined, error: new Error('Invalid from address')};
	}
	if (isZeroAddress(quoteRequest.sellToken)) {
		return {data: undefined, error: new Error('Invalid sell token')};
	}
	if (isZeroAddress(quoteRequest.buyToken)) {
		return {data: undefined, error: new Error('Invalid buy token')};
	}
	if (toBigInt(request?.inputAmount) <= 0n) {
		return {data: undefined, error: new Error('Invalid sell amount')};
	}

	quoteRequest.validTo = Math.round((new Date().setMinutes(new Date().getMinutes() + 10) / 1000));
	try {
		const result = await orderBookApi.getQuote(quoteRequest);
		return {data: result, error: undefined};
	} catch (error) {
		return {data: undefined, error: error as Error};
	}
}

export function useSolverCowswap(): TSolverContext {
	const {zapSlippage} = useYearn();
	const {provider} = useWeb3();
	const {safeChainID} = useChainID();
	const maxIterations = 1000; // 1000 * up to 3 seconds = 3000 seconds = 50 minutes
	const shouldUsePresign = false; //Debug only
	const request = useRef<TInitSolverArgs>();
	const latestQuote = useRef<OrderQuoteResponse>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});
	const isDisabled = isSolverDisabled[Solver.enum.Cowswap] || safeChainID !== 1;

	/* 🔵 - Yearn Finance **************************************************************************
	** A slippage of 1% per default is set to avoid the transaction to fail due to price
	** fluctuations. The buyAmountWithSlippage is used to request this amount instead of the
	** original buyAmount.
	**********************************************************************************************/
	const getBuyAmountWithSlippage = useCallback((currentQuote: OrderQuoteResponse, decimals: number): string => {
		if (!currentQuote) {
			return '0';
		}
		const {quote} = currentQuote;
		const buyAmount = Number(ethers.utils.formatUnits(quote.buyAmount, decimals));
		const withSlippage = ethers.utils.parseUnits((buyAmount * (1 - Number(zapSlippage / 100))).toFixed(decimals), decimals);
		return withSlippage.toString();
	}, [zapSlippage]);

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
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
		const sellToken = _request.isDepositing ? _request.inputToken : _request.outputToken;

		/******************************************************************************************
		** This first obvious check is to see if the solver is disabled. If it is, we return 0.
		******************************************************************************************/
		if (isDisabled) {
			return toNormalizedBN(0);
		}

		/******************************************************************************************
		** Then, we check if the solver can be used for this specific sellToken. If it can't, we
		** return 0.
		** This solveVia array is set via the yDaemon tokenList process. If a solve is not set for
		** a token, you can contact the yDaemon team to add it.
		******************************************************************************************/
		if (!sellToken.solveVia?.includes(Solver.enum.Cowswap)) {
			return toNormalizedBN(0);
		}

		/******************************************************************************************
		** Finally, we check if the sellToken is ETH. Indeed, the cowswap solver can't be used to
		** sell ETH, but can be used to buy ETH. So, if we are selling ETH (aka depositing ETH vs
		** a vault token) we return 0.
		******************************************************************************************/
		if (_request.isDepositing && isEth(sellToken.value)) {
			return toNormalizedBN(0);
		}

		/******************************************************************************************
		** At this point, we know that the solver can be used for this specific token. We set the
		** request to the provided value, as it's required to get the quote, and we call getQuote
		** to get the current quote for the provided request.current.
		******************************************************************************************/
		request.current = _request;
		const {data, error} = await getQuote(_request);
		if (!data) {
			type TCowRequestError = {body: {description: string}};
			const err = error as unknown as TCowRequestError;
			if (error && !shouldLogError) {
				if (err?.body?.description) {
					toast({type: 'error', content: err?.body?.description});
				} else {
					toast({type: 'error', content: 'Zap not possible. Try again later or pick another token.'});
				}
			}
			return toNormalizedBN(0);
		}
		latestQuote.current = data;
		const buyAmountWithSlippage = getBuyAmountWithSlippage(data, _request?.outputToken?.decimals || 18);
		return toNormalizedBN(buyAmountWithSlippage || 0, _request?.outputToken?.decimals || 18);
	}, [getBuyAmountWithSlippage, isDisabled]);

	/* 🔵 - Yearn Finance **************************************************************************
	** signCowswapOrder is used to sign the order with the user's wallet. The signature is used
	** to execute the order.
	** If shouldUsePresign is set to true, the signature is not required and the approval is
	** skipped. This should only be used for debugging purposes.
	**********************************************************************************************/
	const signCowswapOrder = useCallback(async (quote: Order): Promise<SigningResult> => {
		if (shouldUsePresign) {
			await new Promise(async (resolve): Promise<NodeJS.Timeout> => setTimeout(resolve, 1000));
			return ({signature: '0x', signingScheme: 'presign'} as unknown) as SigningResult;
		}

		assert(provider, 'Provider is not set');

		const wagmiSigner = await provider.getWalletClient();
		const wagmiProvider = await provider.getProvider();
		const ethersProvider = new ethers.providers.Web3Provider(wagmiProvider);
		const signer = ethersProvider.getSigner(wagmiSigner.account.address);

		const rawSignature = await OrderSigningUtils.signOrder(
			{...quote as UnsignedOrder},
			safeChainID,
			signer
		);
		return rawSignature;
	}, [shouldUsePresign, provider, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Cowswap orders have a validity period and the return value on submit is not the execution
	** status of the order. This method is used to check the status of the order and returns a
	** boolean value indicating whether the order was successful or not.
	** It will timeout once the order is no longer valid or after 50 minutes (max should be 30mn)
	**********************************************************************************************/
	async function checkOrderStatus(orderUID: string, validTo: number): Promise<{isSuccessful: boolean, error?: Error}> {
		for (let i = 0; i < maxIterations; i++) {
			const {data: order} = await axios.get(`https://api.cow.fi/mainnet/api/v1/orders/${orderUID}`);
			if (order?.status === 'fulfilled') {
				return ({isSuccessful: true});
			}
			if (order?.status === 'cancelled' || order?.status === 'expired') {
				return ({isSuccessful: false, error: new Error('TX fail because the order was not fulfilled')});
			}
			if (validTo.valueOf() < (new Date().valueOf() / 1000)) {
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
	const execute = useCallback(async (): Promise<TTxResponse> => {
		if (isDisabled) {
			return ({isSuccessful: false});
		}

		assert(latestQuote?.current?.quote, 'No quote available');
		assert(request?.current, 'No request available');

		const {quote, from, id} = latestQuote.current;
		const buyAmountWithSlippage = getBuyAmountWithSlippage(
			latestQuote.current,
			request.current.outputToken.decimals
		);
		quote.buyAmount = buyAmountWithSlippage;
		const {signature, signingScheme} = await signCowswapOrder(quote as Order);
		const orderCreation: OrderCreation = {
			...quote,
			buyAmount: buyAmountWithSlippage,
			from: from,
			quoteId: id,
			signature: signature,
			signingScheme: (shouldUsePresign ? 'presign' : signingScheme) as string as SigningScheme
		};

		const orderUID = await orderBookApi.sendOrder(orderCreation);
		if (orderUID) {
			const {isSuccessful, error} = await checkOrderStatus(orderUID, quote.validTo);
			if (error) {
				console.error(error);
				return ({isSuccessful: false, error: new BaseError('Tx fail because the order was not fulfilled')});
			}
			return {isSuccessful};
		}

		return ({isSuccessful: false});
	}, [getBuyAmountWithSlippage, shouldUsePresign, signCowswapOrder, isDisabled]);

	/* 🔵 - Yearn Finance ******************************************************
	** Format the quote to a normalized value, which will be used for subsequent
	** process and displayed to the user.
	**************************************************************************/
	const expectedOut = useMemo((): TNormalizedBN => {
		if (!latestQuote?.current?.quote?.buyAmount || isDisabled) {
			return (toNormalizedBN(0));
		}
		return (
			toNormalizedBN(
				toBigInt(latestQuote?.current?.quote?.buyAmount),
				request?.current?.outputToken?.decimals || 18
			)
		);
	}, [latestQuote, isDisabled]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the allowance for the token to be used by the solver. This will
	** be used to determine if the user should approve the token or not.
	**************************************************************************/
	const onRetrieveAllowance = useCallback(async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
		if (isDisabled) {
			return toNormalizedBN(0);
		}
		assert(request.current, 'Request is not defined');
		assert(request?.current?.inputToken?.solveVia?.includes(Solver.enum.Cowswap), 'Input token is not supported by Cowswap');

		const key = allowanceKey(
			safeChainID,
			request.current.inputToken.value,
			request.current.outputToken.value,
			request.current.from
		);
		if (existingAllowances.current[key] && !shouldForceRefetch) {
			return existingAllowances.current[key];
		}
		const allowance = await allowanceOf({
			connector: provider,
			tokenAddress: request.current.inputToken.value,
			spenderAddress: SOLVER_COW_VAULT_RELAYER_ADDRESS
		});
		existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
		return existingAllowances.current[key];
	}, [isDisabled, provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an signature to approve the token to be used by the Cowswap
	** solver. A single signature is required, which will allow the spending
	** of the token by the Cowswap solver.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = MAX_UINT_256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		if (isDisabled) {
			return;
		}
		assert(request.current, 'Request is not defined');
		assert(request?.current?.inputToken?.solveVia?.includes(Solver.enum.Cowswap), 'Input token is not supported by Cowswap');

		const isApproved = await isApprovedERC20(
			provider,
			request.current.inputToken.value, //token to approve
			SOLVER_COW_VAULT_RELAYER_ADDRESS, //Cowswap relayer
			toBigInt(amount)
		);
		if (isApproved) {
			return onSuccess();
		}
		const result = await approveERC20({
			connector: provider,
			contractAddress: request.current.inputToken.value,
			spenderAddress: SOLVER_COW_VAULT_RELAYER_ADDRESS,
			amount: toBigInt(amount),
			statusHandler: txStatusSetter
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}, [provider, isDisabled]);

	/* 🔵 - Yearn Finance ******************************************************
	** This execute function is not an actual deposit, but a swap using the
	** Cowswap solver. The deposit will be executed by the Cowswap solver by
	** simply swapping the input token for the output token.
	**************************************************************************/
	const onExecute = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(provider, 'Provider is not defined');
		txStatusSetter({...defaultTxStatus, pending: true});

		try {
			const result = await execute();
			if (result.isSuccessful) {
				txStatusSetter({...defaultTxStatus, success: true});
				onSuccess();
			} else {
				txStatusSetter({...defaultTxStatus, error: true, errorMessage: (result.error as BaseError)?.message || 'Transaction failed'});
			}
		} catch (error) {
			txStatusSetter({...defaultTxStatus, error: true, errorMessage: 'Transaction rejected'});
		} finally {
			setTimeout((): void => {
				txStatusSetter({...defaultTxStatus});
			}, 3000);
		}

	}, [execute, provider]);

	return useMemo((): TSolverContext => ({
		type: Solver.enum.Cowswap,
		quote: expectedOut,
		init,
		onRetrieveAllowance,
		onApprove,
		onExecuteDeposit: onExecute,
		onExecuteWithdraw: onExecute
	}), [expectedOut, init, onApprove, onExecute, onRetrieveAllowance]);
}
