import {useCallback, useMemo, useRef} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {assert, toAddress, toBigInt, toNormalizedBN} from '@builtbymom/web3/utils';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import {getVaultEstimateOut} from '@vaults/utils/getVaultEstimateOut';
import {readContract} from '@wagmi/core';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {allowanceOf, approveERC20, migrateShares} from '@common/utils/actions';
import {ZAP_CRV_ABI} from '@yCRV/utils/abi/zapCRV.abi';
import {zapCRV} from '@yCRV/utils/actions';

import type {TDict, TNormalizedBN} from '@builtbymom/web3/types';
import type {TTxStatus} from '@builtbymom/web3/utils/wagmi';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export function useSolverInternalMigration(): TSolverContext {
	const {provider} = useWeb3();
	const latestQuote = useRef<TNormalizedBN>();
	const request = useRef<TInitSolverArgs>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});

	/* 🔵 - Yearn Finance **************************************************************************
	 ** init will be called when the cowswap solver should be used to perform the desired swap.
	 ** It will set the request to the provided value, as it's required to get the quote, and will
	 ** call getQuote to get the current quote for the provided request.
	 **********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN> => {
		if (isSolverDisabled(Solver.enum.InternalMigration)) {
			return toNormalizedBN(0);
		}
		request.current = _request;
		if (request.current.migrator === ZAP_YEARN_VE_CRV_ADDRESS) {
			const estimateOut = await readContract({
				address: ZAP_YEARN_VE_CRV_ADDRESS,
				abi: ZAP_CRV_ABI,
				chainId: request.current.chainID,
				functionName: 'calc_expected_out',
				args: [request.current.inputToken.value, request.current.outputToken.value, request.current.inputAmount]
			});
			const minAmountWithSlippage = estimateOut - (estimateOut * 6n) / 10_000n;
			latestQuote.current = toNormalizedBN(minAmountWithSlippage);
			return latestQuote.current;
		}
		const estimateOut = await getVaultEstimateOut({
			inputToken: toAddress(_request.inputToken.value),
			outputToken: toAddress(_request.outputToken.value),
			inputDecimals: _request.inputToken.decimals,
			outputDecimals: _request.outputToken.decimals,
			inputAmount: _request.inputAmount,
			isDepositing: _request.isDepositing,
			chainID: _request.chainID
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
				return toNormalizedBN(0);
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
			amount = MAX_UINT_256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.inputToken, 'Input token is not defined');
			assert(request.current.migrator, 'Input token is not defined');

			const result = await approveERC20({
				connector: provider,
				chainID: request.current.chainID,
				contractAddress: toAddress(request.current.inputToken.value),
				spenderAddress: request.current.migrator,
				amount: amount,
				statusHandler: txStatusSetter
			});
			if (result.isSuccessful) {
				onSuccess();
			}
		},
		[provider]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger a deposit web3 action, simply trying to deposit `amount` tokens to
	 ** the selected vault.
	 **************************************************************************/
	const onExecuteMigration = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set');

			if (request.current.migrator === ZAP_YEARN_VE_CRV_ADDRESS) {
				const _expectedOut = await readContract({
					address: ZAP_YEARN_VE_CRV_ADDRESS,
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
					contractAddress: ZAP_YEARN_VE_CRV_ADDRESS,
					inputToken: request.current.inputToken.value, //_input_token
					outputToken: request.current.outputToken.value, //_output_token
					amount: request.current.inputAmount, //_amount
					minAmount: toBigInt(_expectedOut), //_min_out
					slippage: toBigInt(0.06 * 100),
					statusHandler: txStatusSetter
				});
				if (result.isSuccessful) {
					onSuccess();
				}
				return;
			}

			const result = await migrateShares({
				connector: provider,
				chainID: request.current.chainID,
				contractAddress: request.current.migrator,
				fromVault: request.current.inputToken.value,
				toVault: request.current.outputToken.value,
				statusHandler: txStatusSetter
			});
			if (result.isSuccessful) {
				onSuccess();
			}
		},
		[provider]
	);

	return useMemo(
		(): TSolverContext => ({
			type: Solver.enum.InternalMigration,
			quote: latestQuote?.current || toNormalizedBN(0),
			init,
			onRetrieveAllowance,
			onApprove,
			onExecuteDeposit: onExecuteMigration,
			onExecuteWithdraw: async (): Promise<void> => Promise.reject()
		}),
		[latestQuote, init, onApprove, onExecuteMigration, onRetrieveAllowance]
	);
}
