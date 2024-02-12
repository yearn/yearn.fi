import {useCallback, useMemo, useRef} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {assert, isEthAddress, toAddress, toNormalizedBN, zeroNormalizedBN} from '@builtbymom/web3/utils';
import {isSolverDisabled} from '@vaults/contexts/useSolver';
import {getEthZapperContract, getNativeTokenWrapperContract} from '@vaults/utils';
import {getVaultEstimateOut} from '@vaults/utils/getVaultEstimateOut';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {Solver} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokenListBalances';
import {allowanceKey} from '@common/utils';
import {allowanceOf, approveERC20, depositETH, withdrawETH} from '@common/utils/actions';

import type {TDict, TNormalizedBN} from '@builtbymom/web3/types';
import type {TTxStatus} from '@builtbymom/web3/utils/wagmi';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export function useSolverChainCoin(): TSolverContext {
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
		if (isSolverDisabled(Solver.enum.ChainCoin)) {
			return zeroNormalizedBN;
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
			chainID: _request.chainID
		});
		latestQuote.current = estimateOut;
		return latestQuote.current;
	}, []);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Retrieve the allowance for the token to be used by the solver. This will
	 ** be used to determine if the user should approve the token or not.
	 ** No allowance required if depositing chainCoin, so set it to infinity.
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

	/* 🔵 - Yearn Finance ******************************************************
	 ** When we want to withdraw a yvWrappedCoin to the base chain coin, we first
	 ** need to approve the yvWrappedCoin to be used by the zap contract.
	 **************************************************************************/
	const onApprove = useCallback(
		async (
			amount = MAX_UINT_256,
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
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
				onSuccess();
			}
		},
		[provider]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger a deposit web3 action using the ETH zap contract to deposit ETH
	 ** to the selected yvETH vault. The contract will first convert ETH to WETH,
	 ** aka the vault underlying token, and then deposit it to the vault.
	 **************************************************************************/
	const onExecuteDeposit = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
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
				onSuccess();
			}
		},
		[provider]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger a withdraw web3 action using the ETH zap contract to take back
	 ** some ETH from the selected yvETH vault. The contract will first convert
	 ** yvETH to wETH, unwrap the wETH and send them to the user.
	 **************************************************************************/
	const onExecuteWithdraw = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
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
				onSuccess();
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
