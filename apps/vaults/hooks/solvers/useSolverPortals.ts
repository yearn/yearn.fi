import {useCallback, useMemo, useRef} from 'react';
import {BaseError, isHex, zeroAddress} from 'viem';
import axios from 'axios';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {
	assert,
	assertAddress,
	isEthAddress,
	isZero,
	isZeroAddress,
	toAddress,
	toBigInt,
	toNormalizedBN,
	zeroNormalizedBN
} from '@builtbymom/web3/utils';
import {
	allowanceOf,
	approveERC20,
	defaultTxStatus,
	retrieveConfig,
	toWagmiProvider
} from '@builtbymom/web3/utils/wagmi';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import {isValidPortalsErrorObject} from '@vaults/hooks/helpers/isValidPortalsErrorObject';
import {getPortalsApproval, getPortalsEstimate, getPortalsTx, PORTALS_NETWORK} from '@vaults/hooks/usePortalsApi';
import {Solver} from '@vaults/types/solvers';
import {sendTransaction, switchChain, waitForTransactionReceipt} from '@wagmi/core';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {allowanceKey} from '@yearn-finance/web-lib/utils/helpers';
import {useYearn} from '@common/contexts/useYearn';

import type {TDict, TNormalizedBN} from '@builtbymom/web3/types';
import type {TTxResponse, TTxStatus} from '@builtbymom/web3/utils/wagmi';
import type {TPortalsEstimate} from '@vaults/hooks/usePortalsApi';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export type TPortalsQuoteResult = {
	result: TPortalsEstimate | null;
	isLoading: boolean;
	error?: Error;
};

async function getQuote(
	request: TInitSolverArgs,
	zapSlippage: number
): Promise<{data: TPortalsEstimate | null; error?: Error}> {
	const network = PORTALS_NETWORK.get(request.chainID);
	let inputToken = request.inputToken.value;

	if (isEthAddress(request.inputToken.value)) {
		inputToken = zeroAddress;
	}
	if (isZeroAddress(request.outputToken.value)) {
		return {data: null, error: new Error('Invalid buy token')};
	}
	if (isZero(request.inputAmount)) {
		return {data: null, error: new Error('Invalid sell amount')};
	}

	try {
		return getPortalsEstimate({
			params: {
				inputToken: `${network}:${toAddress(inputToken)}`,
				outputToken: `${network}:${toAddress(request.outputToken.value)}`,
				inputAmount: toBigInt(request.inputAmount).toString(),
				slippageTolerancePercentage: String(zapSlippage)
			}
		});
	} catch (error) {
		console.error(error);
		let errorContent = 'Portals.fi zap not possible. Try again later or pick another token.';
		if (axios.isAxiosError(error)) {
			const description = error.response?.data?.description;
			errorContent += `${description ? ` (Reason: [${description}])` : ''}`;
		}
		return {data: null, error: new Error(errorContent)};
	}
}

/**************************************************************************************************
 ** The Portals solver is used to deposit and withdraw tokens to/from the vaults when the token the
 ** user wants to deposit or withdraw is not the underlying/expected token. This is for example
 ** when the user wants to deposit DAI into an USDC vault. This solver offer a quick and easy way
 ** to deposit it by swapping the DAI for yvUSDC.
 ** This is NOT a vanilla deposit/withdraw, but a swap using the Portals protocol, which require a
 ** third party to execute the swap, in an asynchronous way, with fees and slippage.
 *************************************************************************************************/
export function useSolverPortals(): TSolverContext {
	const {provider} = useWeb3();
	const request = useRef<TInitSolverArgs>();
	const latestQuote = useRef<TPortalsEstimate>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});
	const {zapSlippage} = useYearn();

	/**********************************************************************************************
	 ** init will be called when the Portals solver should be used to perform the desired swap.
	 ** It will set the request to the provided value, as it's required to get the quote, and will
	 ** call getQuote to get the current quote for the provided request.current.
	 **********************************************************************************************/
	const init = useCallback(
		async (_request: TInitSolverArgs, shouldLogError?: boolean): Promise<TNormalizedBN | undefined> => {
			if (isSolverDisabled(Solver.enum.Portals)) {
				return undefined;
			}
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
			if (isSolverDisabled(Solver.enum.Portals)) {
				return undefined;
			}

			/******************************************************************************************
			 ** Then, we check if the solver can be used for this specific sellToken. If it can't, we
			 ** return 0.
			 ** This solveVia array is set via the yDaemon tokenList process. If a solve is not set for
			 ** a token, you can contact the yDaemon team to add it.
			 ******************************************************************************************/
			if (!sellToken.solveVia?.includes(Solver.enum.Portals)) {
				return undefined;
			}

			/******************************************************************************************
			 ** Same is the amount is 0. If it is, we return 0.
			 ******************************************************************************************/
			if (isZero(_request.inputAmount)) {
				return undefined;
			}

			/******************************************************************************************
			 ** At this point, we know that the solver can be used for this specific token. We set the
			 ** request to the provided value, as it's required to get the quote, and we call getQuote
			 ** to get the current quote for the provided request.current.
			 ******************************************************************************************/
			request.current = _request;
			const {data, error} = await getQuote(_request, zapSlippage);
			if (!data) {
				const errorMessage = (error as any)?.response?.data?.message || error?.message;
				if (errorMessage && shouldLogError) {
					console.error(errorMessage);
					toast({
						type: 'error',
						content: `Portals.fi zap not possible: ${errorMessage}`
					});
				}
				return undefined;
			}
			latestQuote.current = data;
			return toNormalizedBN(data?.outputAmount || 0, request?.current?.outputToken?.decimals || 18);
		},
		[zapSlippage]
	);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** execute will send the post request to execute the order and wait for it to be executed, no
	 ** matter the result. It returns a boolean value indicating whether the order was successful or
	 ** not.
	 **********************************************************************************************/
	const execute = useCallback(async (): Promise<TTxResponse> => {
		if (!request.current || isSolverDisabled(Solver.enum.Portals)) {
			return {isSuccessful: false};
		}

		assert(provider, 'Provider is not set');
		assert(request.current, 'Request is not set');
		assert(latestQuote.current, 'Quote is not set');
		assert(zapSlippage > 0, 'Slippage cannot be 0');

		try {
			let inputToken = request.current.inputToken.value;
			if (isEthAddress(request.current.inputToken.value)) {
				inputToken = zeroAddress;
			}
			const network = PORTALS_NETWORK.get(request.current.chainID);
			const transaction = await getPortalsTx({
				params: {
					sender: toAddress(request.current.from),
					inputToken: `${network}:${toAddress(inputToken)}`,
					outputToken: `${network}:${toAddress(request.current.outputToken.value)}`,
					inputAmount: toBigInt(request.current.inputAmount).toString(),
					slippageTolerancePercentage: String(zapSlippage),
					validate: 'true'
				}
			});

			if (!transaction.data) {
				throw new Error('Transaction data was not fetched from Portals!');
			}

			const {
				tx: {value, to, data, ...rest}
			} = transaction.data;
			const wagmiProvider = await toWagmiProvider(provider);

			if (wagmiProvider.chainId !== request.current.chainID) {
				try {
					await switchChain(retrieveConfig(), {chainId: request.current.chainID});
				} catch (error) {
					if (!(error instanceof BaseError)) {
						return {isSuccessful: false, error};
					}
					console.error(error.shortMessage);
					toast({
						type: 'error',
						content: `Portals.fi zap not possible: ${error.shortMessage}`
					});
					return {isSuccessful: false, error};
				}
			}

			assert(isHex(data), 'Data is not hex');
			assert(wagmiProvider.walletClient, 'Wallet client is not set');
			const hash = await sendTransaction(retrieveConfig(), {
				value: toBigInt(value ?? 0),
				to: toAddress(to),
				data,
				chainId: request.current.chainID,
				...rest
			});
			const receipt = await waitForTransactionReceipt(retrieveConfig(), {
				chainId: wagmiProvider.chainId,
				confirmations: 2,
				hash
			});
			if (receipt.status === 'success') {
				return {isSuccessful: true, receipt: receipt};
			}
			console.error('Fail to perform transaction');
			return {isSuccessful: false};
		} catch (error) {
			if (isValidPortalsErrorObject(error)) {
				const errorMessage = error.response.data.message;
				console.error(errorMessage);
				toast({
					type: 'error',
					content: `Portals.fi zap not possible: ${errorMessage}`
				});
			} else {
				console.error(error);
			}

			return {isSuccessful: false};
		}
	}, [provider, zapSlippage]);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Format the quote to a normalized value, which will be used for subsequent
	 ** process and displayed to the user.
	 **************************************************************************/
	const expectedOut = useMemo((): TNormalizedBN => {
		if (!latestQuote?.current?.outputAmount || !request.current || isSolverDisabled(Solver.enum.Portals)) {
			return zeroNormalizedBN;
		}
		return toNormalizedBN(latestQuote?.current?.outputAmount, request?.current?.outputToken?.decimals || 18);
	}, [latestQuote, request]);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Retrieve the allowance for the token to be used by the solver. This will
	 ** be used to determine if the user should approve the token or not.
	 **************************************************************************/
	const onRetrieveAllowance = useCallback(async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
		if (!latestQuote?.current || !request?.current || isSolverDisabled(Solver.enum.Portals)) {
			return zeroNormalizedBN;
		}
		const inputToken = request.current.inputToken.value;
		if (isEthAddress(request.current.inputToken.value)) {
			return toNormalizedBN(MAX_UINT_256, 18);
		}
		const key = allowanceKey(
			request.current.chainID,
			toAddress(request.current.inputToken.value),
			toAddress(request.current.outputToken.value),
			toAddress(request.current.from)
		);
		if (existingAllowances.current[key] && !shouldForceRefetch) {
			return existingAllowances.current[key];
		}

		try {
			const network = PORTALS_NETWORK.get(request.current.chainID);
			const {data: approval} = await getPortalsApproval({
				params: {
					sender: toAddress(request.current.from),
					inputToken: `${network}:${toAddress(inputToken)}`,
					inputAmount: toBigInt(request.current.inputAmount).toString()
				}
			});

			if (!approval) {
				throw new Error('Portals approval not found');
			}

			existingAllowances.current[key] = toNormalizedBN(
				toBigInt(approval.context.allowance),
				request.current.inputToken.decimals
			);
			return existingAllowances.current[key];
		} catch (error) {
			console.error(error);
			return zeroNormalizedBN;
		}
	}, []);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger an signature to approve the token to be used by the Portals
	 ** solver. A single signature is required, which will allow the spending
	 ** of the token by the Portals solver.
	 **************************************************************************/
	const onApprove = useCallback(
		async (
			amount = MAX_UINT_256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			if (!request.current || isSolverDisabled(Solver.enum.Portals) || !provider) {
				return;
			}
			assert(request.current, 'Request is not set');
			assert(request.current.inputToken, 'Input token is not set');
			assert(request.current.inputAmount, 'Input amount is not set');

			try {
				const network = PORTALS_NETWORK.get(request.current.chainID);
				const {data: approval} = await getPortalsApproval({
					params: {
						sender: toAddress(request.current.from),
						inputToken: `${network}:${toAddress(request.current.inputToken.value)}`,
						inputAmount: toBigInt(request.current.inputAmount).toString()
					}
				});

				if (!approval) {
					return;
				}

				const allowance = await allowanceOf({
					connector: provider,
					chainID: request.current.inputToken.chainID,
					tokenAddress: toAddress(request.current.inputToken.value), //token to approve
					spenderAddress: toAddress(approval.context.spender) //contract to approve
				});
				if (allowance < amount) {
					assertAddress(approval.context.spender, 'spender');
					const result = await approveERC20({
						connector: provider,
						chainID: request.current.chainID,
						contractAddress: request.current.inputToken.value,
						spenderAddress: approval.context.spender,
						amount: amount,
						statusHandler: txStatusSetter
					});
					if (result.isSuccessful) {
						await onSuccess();
					}
					return;
				}
				await onSuccess();
				return;
			} catch (error) {
				console.error(error);
				return;
			}
		},
		[provider]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** This execute function is not an actual deposit/withdraw, but a swap using
	 ** the Portals solver. The deposit will be executed by the Portals solver by
	 ** simply swapping the input token for the output token.
	 **************************************************************************/
	const onExecute = useCallback(
		async (
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
		},
		[execute, provider]
	);

	return useMemo(
		(): TSolverContext => ({
			type: Solver.enum.Portals,
			quote: expectedOut,
			init,
			onRetrieveAllowance,
			onApprove,
			onExecuteDeposit: onExecute,
			onExecuteWithdraw: onExecute
		}),
		[expectedOut, init, onApprove, onExecute, onRetrieveAllowance]
	);
}
