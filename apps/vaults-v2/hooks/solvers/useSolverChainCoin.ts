import {useCallback, useMemo, useRef} from 'react';
import {maxUint256} from 'viem';
import {isSolverDisabled} from '@vaults-v2/contexts/useSolver';
import {Solver} from '@vaults-v2/types/solvers';
import {getEthZapperContract, getNativeTokenWrapperContract} from '@vaults-v2/utils';
import {getVaultEstimateOut} from '@vaults-v2/utils/getVaultEstimateOut';
import {useWeb3} from '@lib/contexts/useWeb3';
import {assert, isEthAddress, toAddress, toNormalizedBN, zeroNormalizedBN} from '@lib/utils';
import {allowanceKey} from '@lib/utils/helpers';
import {allowanceOf, approveERC20} from '@lib/utils/wagmi';
import {depositETH, withdrawETH} from '@lib/utils/wagmi/actions';

import type {TransactionReceipt} from 'viem';
import type {TDict, TNormalizedBN} from '@lib/types';
import type {TTxStatus} from '@lib/utils/wagmi';
import type {TInitSolverArgs, TSolverContext} from '@vaults-v2/types/solvers';

/**************************************************************************************************
 ** The ChainCoin solver is a specific solver that would work only for some vaults. It aims to help
 ** the user to deposit and withdraw from/to a vault when the required underlying token is the
 ** wrapped representation of the chain coin. For example, when the user wants to deposit ETH to a
 ** yvETH vault, the solver will convert the ETH to WETH and deposit it to the vault, all in one
 ** transaction, thanks to a Zap Contract.
 ** An example of this zap contract is available here:
 ** https://etherscan.io/address/0xd1791428c38e25d459d5b01fb25e942d4ad83a25#code
 **
 ** Note: DISABLED
 *************************************************************************************************/
export function useSolverChainCoin(): TSolverContext {
	const {provider} = useWeb3();
	const latestQuote = useRef<TNormalizedBN>();
	const request = useRef<TInitSolverArgs>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});

	/**********************************************************************************************
	 ** init will be called when the cowswap solver should be used to perform the desired swap.
	 ** It will set the request to the provided value, as it's required to get the quote, and will
	 ** call getQuote to get the current quote for the provided request.
	 *********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN | undefined> => {
		if (isSolverDisabled(Solver.enum.ChainCoin)) {
			return undefined;
		}
		request.current = _request;
		const wrapperToken = getNativeTokenWrapperContract(_request.chainID);
		const estimateOut = await getVaultEstimateOut({
			inputToken: _request.isDepositing ? toAddress(wrapperToken) : toAddress(_request.inputToken.value),
			outputToken: _request.isDepositing ? toAddress(_request.outputToken.value) : toAddress(wrapperToken),
			inputDecimals: _request.inputToken.decimals,
			outputDecimals: _request.outputToken.decimals,
			inputAmount: _request.inputAmount,
			isDepositing: _request.isDepositing,
			chainID: _request.chainID,
			version: _request.version,
			from: toAddress(_request.from)
		});
		latestQuote.current = estimateOut;
		return latestQuote.current;
	}, []);

	/**********************************************************************************************
	 ** Retrieve the allowance for the token to be used by the solver. This will be used to
	 ** determine if the user should approve the token or not.
	 ** No allowance required if depositing chainCoin, so set it to infinity.
	 *********************************************************************************************/
	const onRetrieveAllowance = useCallback(
		async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
			if (!request?.current || !provider) {
				return zeroNormalizedBN;
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

			assert(isEthAddress(request.current.outputToken.value), 'Out is not ETH');
			const allowance = await allowanceOf({
				connector: provider,
				chainID: request.current.inputToken.chainID,
				tokenAddress: toAddress(request.current.inputToken.value),
				spenderAddress: toAddress(getEthZapperContract(request.current.chainID))
			});
			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
			return existingAllowances.current[key];
		},
		[provider]
	);

	/**********************************************************************************************
	 ** When we want to withdraw a yvWrappedCoin to the base chain coin, we first need to approve
	 ** the yvWrappedCoin to be used by the zap contract.
	 *********************************************************************************************/
	const onApprove = useCallback(
		async (
			amount = maxUint256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			try {
				assert(request?.current?.inputToken, 'Input token is not set');

				const result = await approveERC20({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: toAddress(request.current.inputToken.value),
					spenderAddress: getEthZapperContract(request.current.chainID),
					amount: amount,
					statusHandler: txStatusSetter
				});
				if (result.isSuccessful) {
					await onSuccess(result.receipt);
				} else if (onError) {
					await onError(new Error('Approval failed'));
				}
			} catch (error) {
				if (onError) {
					await onError(error instanceof Error ? error : new Error('Unknown error occurred'));
				}
			}
		},
		[provider]
	);

	/**********************************************************************************************
	 ** Trigger a deposit web3 action using the ETH zap contract to deposit ETH to the selected
	 ** yvETH vault. The contract will first convert ETH to WETH, aka the vault underlying token,
	 ** and then deposit it to the vault.
	 *********************************************************************************************/
	const onExecuteDeposit = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			try {
				assert(request.current, 'Request is not set');
				assert(request.current.inputAmount, 'Input amount is not set');

				const result = await depositETH({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: getEthZapperContract(request.current.chainID),
					amount: request.current.inputAmount,
					statusHandler: txStatusSetter
				});
				if (result.isSuccessful) {
					await onSuccess(result.receipt);
				} else if (onError) {
					await onError(new Error('Deposit failed'));
				}
			} catch (error) {
				if (onError) {
					await onError(error instanceof Error ? error : new Error('Unknown error occurred'));
				}
			}
		},
		[provider]
	);

	/**********************************************************************************************
	 ** Trigger a withdraw web3 action using the ETH zap contract to take back some ETH from the
	 ** selected yvETH vault. The contract will first convert yvETH to wETH, unwrap the wETH and
	 ** send them to the user.
	 *********************************************************************************************/
	const onExecuteWithdraw = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			try {
				assert(request.current, 'Request is not set');
				assert(request.current.inputAmount, 'Input amount is not set');

				const result = await withdrawETH({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: getEthZapperContract(request.current.chainID),
					amount: request.current.inputAmount,
					statusHandler: txStatusSetter
				});
				if (result.isSuccessful) {
					await onSuccess(result.receipt);
				} else if (onError) {
					await onError(new Error('Withdrawal failed'));
				}
			} catch (error) {
				if (onError) {
					await onError(error instanceof Error ? error : new Error('Unknown error occurred'));
				}
			}
		},
		[provider]
	);

	return useMemo(
		(): TSolverContext => ({
			type: Solver.enum.ChainCoin,
			quote: latestQuote?.current || zeroNormalizedBN,
			init,
			onRetrieveAllowance,
			onApprove,
			onExecuteDeposit,
			onExecuteWithdraw
		}),
		[latestQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance]
	);
}
