import {useCallback, useMemo, useRef} from 'react';
import getVaultEstimateOut from '@vaults/utils/getVaultEstimateOut';
import {readContract} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {allowanceOf, approveERC20, migrateShares} from '@common/utils/actions';
import {assert} from '@common/utils/assert';
import ZAP_CRV_ABI from '@yCRV/utils/abi/zapCRV.abi';
import {zapCRV} from '@yCRV/utils/actions';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export function useSolverInternalMigration(): TSolverContext {
	const {provider} = useWeb3();
	const {chainID, safeChainID} = useChainID();
	const latestQuote = useRef<TNormalizedBN>();
	const request = useRef<TInitSolverArgs>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN> => {
		request.current = _request;
		if (request.current.migrator === ZAP_YEARN_VE_CRV_ADDRESS) {
			const estimateOut = await readContract({
				address: ZAP_YEARN_VE_CRV_ADDRESS,
				abi: ZAP_CRV_ABI,
				functionName: 'calc_expected_out',
				args: [
					request.current.inputToken.value,
					request.current.outputToken.value,
					request.current.inputAmount
				]
			});
			const minAmountWithSlippage = (estimateOut - (estimateOut * 6n / 10_000n));
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
			chainID: chainID
		});
		latestQuote.current = estimateOut;
		return latestQuote.current;
	}, [chainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Retrieve the allowance for the token to be used by the solver. This will
	** be used to determine if the user should approve the token or not.
	**************************************************************************/
	const onRetrieveAllowance = useCallback(async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
		if (!request?.current) {
			return toNormalizedBN(0);
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

		const allowance = await allowanceOf({
			connector: provider,
			tokenAddress: toAddress(request.current.inputToken.value),
			spenderAddress: toAddress(request.current.migrator)
		});
		existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
		return existingAllowances.current[key];
	}, [request, safeChainID, provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the migration contract, in charge of migrating the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = MAX_UINT_256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(request.current, 'Request is not set');
		assert(request.current.inputToken, 'Input token is not defined');
		assert(request.current.migrator, 'Input token is not defined');

		const result = await approveERC20({
			connector: provider,
			contractAddress: toAddress(request.current.inputToken.value),
			spenderAddress: request.current.migrator,
			amount: amount,
			statusHandler: txStatusSetter
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}, [provider]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action, simply trying to deposit `amount` tokens to
	** the selected vault.
	**************************************************************************/
	const onExecuteMigration = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(request.current, 'Request is not set');

		if (request.current.migrator === ZAP_YEARN_VE_CRV_ADDRESS) {
			const _expectedOut = await readContract({
				address: ZAP_YEARN_VE_CRV_ADDRESS,
				abi: ZAP_CRV_ABI,
				functionName: 'calc_expected_out',
				args: [
					request.current.inputToken.value,
					request.current.outputToken.value,
					request.current.inputAmount
				]
			});
			const result = await zapCRV({
				connector: provider,
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
			contractAddress: request.current.migrator,
			fromVault: request.current.inputToken.value,
			toVault: request.current.outputToken.value,
			statusHandler: txStatusSetter
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}, [provider]);

	return useMemo((): TSolverContext => ({
		type: Solver.enum.InternalMigration,
		quote: latestQuote?.current || toNormalizedBN(0),
		init,
		onRetrieveAllowance,
		onApprove,
		onExecuteDeposit: onExecuteMigration,
		onExecuteWithdraw: async (): Promise<void> => Promise.reject()
	}), [latestQuote, init, onApprove, onExecuteMigration, onRetrieveAllowance]);
}
