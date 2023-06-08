import {useCallback, useMemo, useRef} from 'react';
import {getEthZapperContract, getNativeTokenWrapperContract} from '@vaults/utils';
import getVaultEstimateOut from '@vaults/utils/getVaultEstimateOut';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isEth} from '@yearn-finance/web-lib/utils/isEth';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {allowanceOf, approveERC20, depositETH, withdrawETH} from '@common/utils/actions';
import {assert} from '@common/utils/assert';

import type {TDict} from '@yearn-finance/web-lib/types';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TNormalizedBN} from '@common/types/types';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

export function useSolverChainCoin(): TSolverContext {
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
		const wrapperToken = getNativeTokenWrapperContract(chainID);
		const estimateOut = await getVaultEstimateOut({
			inputToken: _request.isDepositing ? toAddress(wrapperToken) : toAddress(_request.inputToken.value),
			outputToken: _request.isDepositing ? toAddress(_request.outputToken.value) : toAddress(wrapperToken),
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
	** No allowance required if depositing chainCoin, so set it to infinity.
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

		assert(isEth(request.current.outputToken.value), 'Out is not ETH');
		const allowance = await allowanceOf({
			connector: provider,
			tokenAddress: toAddress(request.current.inputToken.value),
			spenderAddress: toAddress(getEthZapperContract(safeChainID))
		});
		existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
		return existingAllowances.current[key];
	}, [provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** When we want to withdraw a yvWrappedCoin to the base chain coin, we first
	** need to approve the yvWrappedCoin to be used by the zap contract.
	**************************************************************************/
	const onApprove = useCallback(async (
		amount = MAX_UINT_256,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(request?.current?.inputToken, 'Input token is not set');

		const result = await approveERC20({
			connector: provider,
			contractAddress: toAddress(request.current.inputToken.value),
			spenderAddress: getEthZapperContract(safeChainID),
			amount: amount,
			statusHandler: txStatusSetter
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}, [provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action using the ETH zap contract to deposit ETH
	** to the selected yvETH vault. The contract will first convert ETH to WETH,
	** aka the vault underlying token, and then deposit it to the vault.
	**************************************************************************/
	const onExecuteDeposit = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(request.current, 'Request is not set');
		assert(request.current.inputAmount, 'Input amount is not set');

		const result = await depositETH({
			connector: provider,
			contractAddress: getEthZapperContract(safeChainID),
			amount: request.current.inputAmount,
			statusHandler: txStatusSetter
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}, [provider, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the ETH zap contract to take back
	** some ETH from the selected yvETH vault. The contract will first convert
	** yvETH to wETH, unwrap the wETH and send them to the user.
	**************************************************************************/
	const onExecuteWithdraw = useCallback(async (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	): Promise<void> => {
		assert(request.current, 'Request is not set');
		assert(request.current.inputAmount, 'Input amount is not set');

		const result = await withdrawETH({
			connector: provider,
			contractAddress: getEthZapperContract(safeChainID),
			amount: request.current.inputAmount,
			statusHandler: txStatusSetter
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}, [provider, safeChainID]);

	return useMemo((): TSolverContext => ({
		type: Solver.enum.ChainCoin,
		quote: latestQuote?.current || toNormalizedBN(0),
		init,
		onRetrieveAllowance,
		onApprove,
		onExecuteDeposit,
		onExecuteWithdraw
	}), [latestQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance]);
}
