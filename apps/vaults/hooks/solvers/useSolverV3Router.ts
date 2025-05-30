import {useCallback, useMemo, useRef} from 'react';
import {erc20Abi, maxUint256, zeroAddress} from 'viem';
import {useWeb3} from '@lib/contexts/useWeb3';
import {assert, toAddress, toNormalizedBN, zeroNormalizedBN} from '@lib/utils';
import {allowanceOf, approveERC20, retrieveConfig,toWagmiProvider} from '@lib/utils/wagmi';
import {Solver} from '@vaults/types/solvers';
import {getVaultEstimateOut} from '@vaults/utils/getVaultEstimateOut';
import { readContract } from '@wagmi/core';
import {allowanceKey} from '@yearn-finance/web-lib/utils/helpers';
import {useYearn} from '@common/contexts/useYearn';
import { migrateSharesViaRouter} from '@common/utils/actions';

import type {Connector} from 'wagmi';
import type {TDict, TNormalizedBN} from '@lib/types';
import type {TTxStatus} from '@lib/utils/wagmi';
import type {TInitSolverArgs, TSolverContext} from '@vaults/types/solvers';

async function allowanceOfRouter(request: TInitSolverArgs, provider: Connector | undefined): Promise<bigint> {
  if (!request || !provider) {
    return 0n;
  }

	const wagmiProvider = await toWagmiProvider(provider);
	const result = await readContract(retrieveConfig(), {
		...wagmiProvider,
		chainId: request.chainID,
		abi: erc20Abi,
		address: request.asset ?? zeroAddress,
		functionName: 'allowance',
		args: [request.migrator ?? zeroAddress, request.outputToken.value]
	});
	return result || 0n;
}

export function useSolverV3Router(): TSolverContext {
	const {provider} = useWeb3();
	const {maxLoss} = useYearn();
	const latestQuote = useRef<TNormalizedBN>();
	const request = useRef<TInitSolverArgs>();
	const existingAllowances = useRef<TDict<TNormalizedBN>>({});

	const init = useCallback(
		async (_request: TInitSolverArgs): Promise<TNormalizedBN | undefined> => {
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

  const onRetrieveRouterAllowance = useCallback(
		async (shouldForceRefetch?: boolean): Promise<TNormalizedBN> => {
			if (!request?.current || !provider || !request.current.asset || !request.current.migrator) {
				return zeroNormalizedBN;
			}

			const key = allowanceKey(
				request.current.chainID,
				toAddress(request.current.asset),
				toAddress(request.current.migrator),
				toAddress(request.current.outputToken.value)
			);
			if (existingAllowances.current[key] && !shouldForceRefetch) {
				return existingAllowances.current[key];
			}

			const allowance = await allowanceOfRouter(request.current, provider);
			existingAllowances.current[key] = toNormalizedBN(allowance, request.current.inputToken.decimals);
			return existingAllowances.current[key];
		},
    [request, provider]
  );

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

	const onExecuteDeposit = useCallback(
		async (
			txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
			onSuccess: () => Promise<void>
		): Promise<void> => {
			assert(request.current, 'Request is not set');
			assert(request.current.inputToken, 'Output token is not set');
			assert(request.current.inputAmount, 'Input amount is not set');

      const result = await migrateSharesViaRouter({
        connector: provider,
        chainID: request.current.chainID,
        contractAddress: request.current.inputToken.value,
        router: request.current.migrator,
        fromVault: request.current.inputToken.value,
        toVault: request.current.outputToken.value,
        amount: request.current.inputAmount,
        maxLoss,
        statusHandler: txStatusSetter
      });
      if (result.isSuccessful) {
        onSuccess();
      }
      return;
		},
		[provider, maxLoss]
	);

	const onExecuteWithdraw = useCallback(async (): Promise<void> => {
    throw new Error('Not implemented');
  }, [] );

	return useMemo(
		(): TSolverContext => ({
			type: Solver.enum.Vanilla,
			quote: latestQuote?.current || zeroNormalizedBN,
			init,
			onRetrieveAllowance,
      onRetrieveRouterAllowance,
			onApprove,
			onExecuteDeposit,
			onExecuteWithdraw
		}),
		[latestQuote, init, onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance, onRetrieveRouterAllowance]
	);
}
