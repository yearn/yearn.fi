import {useCallback, useMemo, useRef} from 'react';
import {maxUint256} from 'viem';
import {useWeb3} from 'builtbymom-web3-fork/contexts/useWeb3';
import {assert, toAddress, toNormalizedBN, zeroNormalizedBN} from 'builtbymom-web3-fork/utils';
import {allowanceOf, approveERC20} from 'builtbymom-web3-fork/utils/wagmi';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import {Solver} from '@vaults/types/solvers';
import {depositAndStake} from '@vaults/utils/actions';
import {getVaultEstimateOut} from '@vaults/utils/getVaultEstimateOut';
import {allowanceKey} from '@common/utils';
import {YGAUGES_ZAP_ADDRESS} from '@common/utils/constants';

import type {TDict, TNormalizedBN} from 'builtbymom-web3-fork/types';
import type {TTxStatus} from 'builtbymom-web3-fork/utils/wagmi';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export function useSolverJuicedStakingBooster(): TSolverContext {
	const {provider} = useWeb3();
	const latestQuote = useRef<TNormalizedBN>();
	const request = useRef<TInitSolverArgs>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});

	/**********************************************************************************************
	 ** init will be called when the gauge staking booster should be used to perform the desired
	 ** deposit. It will set the request to the provided value, as it's required to get the quote,
	 ** and will call getQuote to get the current quote for the provided request.
	 *********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TNormalizedBN | undefined> => {
		if (isSolverDisabled(Solver.enum.JuicedStakingBooster)) {
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
			from: toAddress(_request.from)
		});
		latestQuote.current = estimateOut;
		return latestQuote.current;
	}, []);

	/**********************************************************************************************
	 ** Retrieve the allowance for the token to be used by the solver. This will be used to
	 ** determine if the user should approve the token or not.
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

			const allowance = await allowanceOf({
				connector: provider,
				chainID: request.current.inputToken.chainID,
				tokenAddress: toAddress(request.current.inputToken.value),
				spenderAddress: toAddress(YGAUGES_ZAP_ADDRESS)
			});
			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
			return existingAllowances.current[key];
		},
		[request, provider]
	);

	/**********************************************************************************************
	 ** Trigger an approve web3 action
	 ** This approve can not be triggered if the wallet is not active (not connected) or if the tx
	 ** is still pending.
	 *********************************************************************************************/
	const onApprove = useCallback(
		async (
			amount = maxUint256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.inputToken, 'Input token is not set');

			const result = await approveERC20({
				connector: provider,
				chainID: request.current.chainID,
				contractAddress: request.current.inputToken.value,
				spenderAddress: YGAUGES_ZAP_ADDRESS,
				amount: amount,
				statusHandler: txStatusSetter
			});
			if (result.isSuccessful) {
				onSuccess();
			}
		},
		[provider]
	);

	/**********************************************************************************************
	 ** Trigger a deposit and stake web3 action, simply trying to zap `amount` tokens via the
	 ** Staking Rewards Zap Contract, to the selected vault.
	 *********************************************************************************************/
	const onExecuteDeposit = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.inputAmount, 'Input amount is not set');

			const result = await depositAndStake({
				connector: provider,
				chainID: request.current.chainID,
				contractAddress: YGAUGES_ZAP_ADDRESS,
				vaultAddress: request.current.outputToken.value,
				vaultVersion: request.current.version,
				stakingPoolAddress: request.current.stakingPoolAddress,
				amount: request.current.inputAmount,
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
			type: Solver.enum.JuicedStakingBooster,
			quote: latestQuote?.current || zeroNormalizedBN,
			init,
			onRetrieveAllowance,
			onApprove,
			onExecuteDeposit,
			onExecuteWithdraw: async (): Promise<void> => undefined
		}),
		[latestQuote, init, onApprove, onExecuteDeposit, onRetrieveAllowance]
	);
}
