import {useCallback, useMemo, useRef} from 'react';
import {maxUint256} from 'viem';
import {readContract} from 'wagmi/actions';
import {isSolverDisabled} from '@vaults-v2/contexts/useSolver';
import {Solver} from '@vaults-v2/types/solvers';
import {ZAP_CRV_ABI} from '@vaults-v2/utils/abi/zapCRV.abi';
import {zapCRV} from '@vaults-v2/utils/actions';
import {getVaultEstimateOut} from '@vaults-v2/utils/getVaultEstimateOut';
import {useNotifications} from '@lib/contexts/useNotifications';
import {useWeb3} from '@lib/contexts/useWeb3';
import {assert, toAddress, toBigInt, toNormalizedBN, zeroNormalizedBN} from '@lib/utils';
import {ZAP_YEARN_VE_CRV_ADDRESS} from '@lib/utils/constants';
import {allowanceKey} from '@lib/utils/helpers';
import {allowanceOf, approveERC20, retrieveConfig} from '@lib/utils/wagmi';
import {migrateShares} from '@lib/utils/wagmi/actions';

import type {Hash, TransactionReceipt} from 'viem';
import type {TDict, TNormalizedBN} from '@lib/types';
import type {TTxStatus} from '@lib/utils/wagmi';
import type {TInitSolverArgs, TSolverContext} from '@vaults-v2/types/solvers';

/**************************************************************************************************
 ** The InternalMigration solver is a special solver used to migrate from one vault to another. It
 ** is used when a new version of a vault is released, and the user wants to migrate their funds.
 *************************************************************************************************/
export function useSolverInternalMigration(): TSolverContext {
	const {provider} = useWeb3();
	const latestQuote = useRef<TNormalizedBN>();
	const request = useRef<TInitSolverArgs>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});

	const {set_shouldOpenCurtain} = useNotifications();

	/* 🔵 - Yearn Finance **************************************************************************
	 ** init will be called when the cowswap solver should be used to perform the desired swap.
	 ** It will set the request to the provided value, as it's required to get the quote, and will
	 ** call getQuote to get the current quote for the provided request.
	 **********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN | undefined> => {
		if (isSolverDisabled(Solver.enum.InternalMigration)) {
			return undefined;
		}
		request.current = _request;
		if (request.current.migrator === ZAP_YEARN_VE_CRV_ADDRESS) {
			const estimateOut = await readContract(retrieveConfig(), {
				address: ZAP_YEARN_VE_CRV_ADDRESS,
				abi: ZAP_CRV_ABI,
				chainId: request.current.chainID,
				functionName: 'calc_expected_out',
				args: [request.current.inputToken.value, request.current.outputToken.value, request.current.inputAmount]
			});
			const minAmountWithSlippage = estimateOut - (estimateOut * 6n) / 10_000n;
			latestQuote.current = toNormalizedBN(minAmountWithSlippage, request.current.outputToken.decimals);
			return latestQuote.current;
		}
		const estimateOut = await getVaultEstimateOut({
			inputToken: toAddress(_request.inputToken.value),
			outputToken: toAddress(_request.outputToken.value),
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

	/* 🔵 - Yearn Finance ******************************************************
	 ** Retrieve the allowance for the token to be used by the solver. This will
	 ** be used to determine if the user should approve the token or not.
	 **************************************************************************/
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

			const allowance = await allowanceOf({
				connector: provider,
				chainID: request.current.inputToken.chainID,
				tokenAddress: toAddress(request.current.inputToken.value),
				spenderAddress: toAddress(request.current.migrator)
			});
			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
			return existingAllowances.current[key];
		},
		[request, provider]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger an approve web3 action, simply trying to approve `amount` tokens
	 ** to be used by the migration contract, in charge of migrating the tokens.
	 ** This approve can not be triggered if the wallet is not active
	 ** (not connected) or if the tx is still pending.
	 **************************************************************************/
	const onApprove = useCallback(
		async (
			amount = maxUint256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			txHashSetter: (txHash: Hash) => void,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			try {
				assert(request.current, 'Request is not set');
				assert(request.current.inputToken, 'Input token is not defined');
				assert(request.current.migrator, 'Migrator is not defined');

				const result = await approveERC20({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: toAddress(request.current.inputToken.value),
					spenderAddress: request.current.migrator,
					amount: amount,
					cta: {
						label: 'View',
						onClick: () => {
							set_shouldOpenCurtain(true);
						}
					},
					statusHandler: txStatusSetter,
					txHashHandler: txHashSetter
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
		[provider, set_shouldOpenCurtain]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger a deposit web3 action, simply trying to deposit `amount` tokens to
	 ** the selected vault.
	 **************************************************************************/
	const onExecuteMigration = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
			txHashSetter: (txHash: Hash) => void,
			onError?: (error: Error) => Promise<void>
		): Promise<void> => {
			try {
				assert(request.current, 'Request is not set');

				if (request.current.migrator === ZAP_YEARN_VE_CRV_ADDRESS) {
					const _expectedOut = await readContract(retrieveConfig(), {
						address: request.current.migrator,
						abi: ZAP_CRV_ABI,
						chainId: request.current.chainID,
						functionName: 'calc_expected_out',
						args: [
							request.current.inputToken.value,
							request.current.outputToken.value,
							request.current.inputAmount
						]
					});
					const result = await zapCRV({
						connector: provider,
						chainID: request.current.chainID,
						contractAddress: request.current.migrator,
						inputToken: request.current.inputToken.value, //_input_token
						outputToken: request.current.outputToken.value, //_output_token
						amount: request.current.inputAmount, //_amount
						minAmount: toBigInt(_expectedOut), //_min_out
						slippage: toBigInt(0.06 * 100),
						statusHandler: txStatusSetter,
						txHashHandler: txHashSetter,
						cta: {
							label: 'View',
							onClick: () => {
								set_shouldOpenCurtain(true);
							}
						}
					});
					if (result.isSuccessful) {
						await onSuccess(result.receipt);
					} else if (onError) {
						await onError(new Error('Migration failed'));
					}
					return;
				}

				const result = await migrateShares({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: request.current.migrator,
					fromVault: request.current.inputToken.value,
					toVault: request.current.outputToken.value,
					cta: {
						label: 'View',
						onClick: () => {
							set_shouldOpenCurtain(true);
						}
					},
					statusHandler: txStatusSetter,
					txHashHandler: txHashSetter
				});
				if (result.isSuccessful) {
					await onSuccess(result.receipt);
				} else if (onError) {
					await onError(new Error('Migration failed'));
				}
			} catch (error) {
				if (onError) {
					await onError(error instanceof Error ? error : new Error('Unknown error occurred'));
				}
			}
		},
		[provider, set_shouldOpenCurtain]
	);

	return useMemo(
		(): TSolverContext => ({
			type: Solver.enum.InternalMigration,
			quote: latestQuote?.current || zeroNormalizedBN,
			init,
			onRetrieveAllowance,
			onApprove,
			onExecuteDeposit: onExecuteMigration,
			onExecuteWithdraw: async (): Promise<void> => Promise.reject()
		}),
		[latestQuote, init, onApprove, onExecuteMigration, onRetrieveAllowance]
	);
}
