import {useCallback, useMemo, useRef} from 'react';
import {getVaultEstimateOut} from '@vaults/utils/getVaultEstimateOut';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {allowanceOf, approveERC20, deposit, withdrawShares} from '@common/utils/actions';
import {assert} from '@common/utils/assert';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export function useSolverVanilla(): TSolverContext {
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
		request.current = _request;
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
			if (!request?.current) {
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
<<<<<<< HEAD
<<<<<<< HEAD
				chainID: safeChainID,
=======
>>>>>>> ba8e0bb9 (feat: add prettier)
=======
				chainID: request.current.inputToken.chainID,
>>>>>>> d3744700 (fix: more chain fixes)
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
		async (amount = MAX_UINT_256, txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>, onSuccess: () => Promise<void>): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.inputToken, 'Input token is not set');
			assert(request.current.outputToken, 'Output token is not set');

			const result = await approveERC20({
				connector: provider,
<<<<<<< HEAD
<<<<<<< HEAD
				chainID: safeChainID,
=======
>>>>>>> ba8e0bb9 (feat: add prettier)
=======
				chainID: request.current.chainID,
>>>>>>> d3744700 (fix: more chain fixes)
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
		async (txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>, onSuccess: () => Promise<void>): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.outputToken, 'Output token is not set');
			assert(request.current.inputAmount, 'Input amount is not set');

			const result = await deposit({
				connector: provider,
<<<<<<< HEAD
<<<<<<< HEAD
				chainID: safeChainID,
=======
>>>>>>> ba8e0bb9 (feat: add prettier)
=======
				chainID: request.current.chainID,
>>>>>>> d3744700 (fix: more chain fixes)
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
		async (txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>, onSuccess: () => Promise<void>): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.inputToken, 'Output token is not set');
			assert(request.current.inputAmount, 'Input amount is not set');

			const result = await withdrawShares({
				connector: provider,
<<<<<<< HEAD
<<<<<<< HEAD
				chainID: safeChainID,
=======
>>>>>>> ba8e0bb9 (feat: add prettier)
=======
				chainID: request.current.chainID,
>>>>>>> d3744700 (fix: more chain fixes)
				contractAddress: request.current.inputToken.value,
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
			type: Solver.enum.Vanilla,
			quote: latestQuote?.current || toNormalizedBN(0),
			init,
			onRetrieveAllowance,
			onApprove,
			onExecuteDeposit,
			onExecuteWithdraw
		}),
		[latestQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance]
	);
}
