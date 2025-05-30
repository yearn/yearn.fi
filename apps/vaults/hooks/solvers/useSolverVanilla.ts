import {useCallback, useMemo, useRef} from 'react';
import {maxUint256} from 'viem';
import {useWeb3} from '@lib/contexts/useWeb3';
import {assert, toAddress, toNormalizedBN, zeroNormalizedBN} from '@lib/utils';
import {allowanceOf, approveERC20} from '@lib/utils/wagmi';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import {Solver} from '@vaults/types/solvers';
import {getVaultEstimateOut} from '@vaults/utils/getVaultEstimateOut';
import {allowanceKey} from '@yearn-finance/web-lib/utils/helpers';
import {useYearn} from '@common/contexts/useYearn';
import {deposit, redeemV3Shares, withdrawShares} from '@common/utils/actions';

import type {TDict, TNormalizedBN} from '@lib/types';
import type {TTxStatus} from '@lib/utils/wagmi';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export function useSolverVanilla(): TSolverContext {
	const {provider} = useWeb3();
	const {maxLoss} = useYearn();
	const latestQuote = useRef<TNormalizedBN>();
	const request = useRef<TInitSolverArgs>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});

	/* 🔵 - Yearn Finance **************************************************************************
	 ** init will be called when the cowswap solver should be used to perform the desired swap.
	 ** It will set the request to the provided value, as it's required to get the quote, and will
	 ** call getQuote to get the current quote for the provided request.
	 **********************************************************************************************/
	const init = useCallback(
		async (_request: TInitSolverArgs): Promise<TNormalizedBN | undefined> => {
			if (isSolverDisabled(Solver.enum.Vanilla)) {
				return undefined;
			}
			request.current = _request;
			const estimateOut = await getVaultEstimateOut({
				inputToken: toAddress(_request.inputToken.value),
				outputToken: toAddress(_request.outputToken.value),
				inputDecimals: _request.inputToken.decimals,
				outputDecimals: _request.outputToken.decimals,
				inputAmount: _request.inputAmount,
				isDepositing: _request.isDepositing,
				chainID: _request.chainID,
				version: _request.version,
				from: toAddress(_request.from),
				maxLoss: maxLoss
			});
			latestQuote.current = estimateOut;
			return latestQuote.current;
		},
		[maxLoss]
	);

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
				spenderAddress: toAddress(request.current.outputToken.value)
			});
			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
			return existingAllowances.current[key];
		},
		[request, provider]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger an approve web3 action, simply trying to approve `amount` tokens
	 ** to be used by the final vault, in charge of depositing the tokens.
	 ** This approve can not be triggered if the wallet is not active
	 ** (not connected) or if the tx is still pending.
	 **************************************************************************/
	const onApprove = useCallback(
		async (
			amount = maxUint256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.inputToken, 'Input token is not set');
			assert(request.current.outputToken, 'Output token is not set');

			const result = await approveERC20({
				connector: provider,
				chainID: request.current.chainID,
				contractAddress: request.current.inputToken.value,
				spenderAddress: request.current.outputToken.value,
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
	const onExecuteDeposit = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.outputToken, 'Output token is not set');
			assert(request.current.inputAmount, 'Input amount is not set');

			const result = await deposit({
				connector: provider,
				chainID: request.current.chainID,
				contractAddress: request.current.outputToken.value,
				amount: request.current.inputAmount,
				statusHandler: txStatusSetter
			});
			if (result.isSuccessful) {
				onSuccess();
			}
		},
		[provider]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger a withdraw web3 action using the vault contract to take back
	 ** some underlying token from this specific vault.
	 **************************************************************************/
	const onExecuteWithdraw = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.inputToken, 'Output token is not set');
			assert(request.current.inputAmount, 'Input amount is not set');
			const isV3 =
				request.current?.version.split('.')?.[0] === '3' || request.current?.version.split('.')?.[0] === '~3';

			if (isV3) {
				const result = await redeemV3Shares({
					connector: provider,
					chainID: request.current.chainID,
					contractAddress: request.current.inputToken.value,
					amount: request.current.inputAmount,
					maxLoss: maxLoss,
					statusHandler: txStatusSetter
				});
				if (result.isSuccessful) {
					onSuccess();
				}
				return;
			}
			const result = await withdrawShares({
				connector: provider,
				chainID: request.current.chainID,
				contractAddress: request.current.inputToken.value,
				amount: request.current.inputAmount,
				statusHandler: txStatusSetter
			});
			if (result.isSuccessful) {
				onSuccess();
			}
		},
		[maxLoss, provider]
	);

	return useMemo(
		(): TSolverContext => ({
			type: Solver.enum.Vanilla,
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
