import React, {createContext, useCallback, useContext, useState} from 'react';
import {useDebouncedEffect, useDeepCompareMemo} from '@react-hookz/web';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolverChainCoin} from '@vaults/hooks/useSolverChainCoin';
import {useSolverCowswap} from '@vaults/hooks/useSolverCowswap';
import {useSolverInternalMigration} from '@vaults/hooks/useSolverInternalMigration';
import {useSolverOptimismBooster} from '@vaults/hooks/useSolverOptimismBooster';
import {useSolverPartnerContract} from '@vaults/hooks/useSolverPartnerContract';
import {useSolverPortals} from '@vaults/hooks/useSolverPortals';
import {useSolverVanilla} from '@vaults/hooks/useSolverVanilla';
import {useSolverWido} from '@vaults/hooks/useSolverWido';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {hash} from '@common/utils';

import type {MaybeString} from '@yearn-finance/web-lib/types';
import type {TSolver} from '@common/schemas/yDaemonTokenListBalances';
import type {TNormalizedBN} from '@common/types/types';
import type {TInitSolverArgs, TSolverContext, TWithSolver} from '@vaults/types/solvers';

export const isSolverDisabled = {
	[Solver.enum.Vanilla]: false,
	[Solver.enum.PartnerContract]: false,
	[Solver.enum.ChainCoin]: false,
	[Solver.enum.InternalMigration]: false,
	[Solver.enum.Cowswap]: false,
	[Solver.enum.OptimismBooster]: false,
	[Solver.enum.Wido]: false,
	[Solver.enum.Portals]: false,
	[Solver.enum.None]: false
};

type TUpdateSolverHandler = {
	request: TInitSolverArgs;
	quote: PromiseSettledResult<TNormalizedBN>;
	solver: TSolver;
	ctx: TSolverContext;
}

const DefaultWithSolverContext: TWithSolver = {
	currentSolver: Solver.enum.Vanilla,
	effectiveSolver: Solver.enum.Vanilla,
	expectedOut: toNormalizedBN(0),
	hash: undefined,
	isLoadingExpectedOut: false,
	onRetrieveExpectedOut: async (): Promise<TNormalizedBN> => toNormalizedBN(0),
	onRetrieveAllowance: async (): Promise<TNormalizedBN> => toNormalizedBN(0),
	onApprove: async (): Promise<void> => Promise.resolve(),
	onExecuteDeposit: async (): Promise<void> => Promise.resolve(),
	onExecuteWithdraw: async (): Promise<void> => Promise.resolve()
};

const WithSolverContext = createContext<TWithSolver>(DefaultWithSolverContext);
function WithSolverContextApp({children}: { children: React.ReactElement }): React.ReactElement {
	const {address} = useWeb3();
	const {currentVault, actionParams, currentSolver, isDepositing} = useActionFlow();
	const cowswap = useSolverCowswap();
	const wido = useSolverWido();
	const vanilla = useSolverVanilla();
	const portals = useSolverPortals();
	const chainCoin = useSolverChainCoin();
	const partnerContract = useSolverPartnerContract();
	const internalMigration = useSolverInternalMigration();
	const optimismBooster = useSolverOptimismBooster();
	const [currentSolverState, set_currentSolverState] = useState<TSolverContext & { hash: MaybeString }>({...vanilla, hash: undefined});
	const [isLoading, set_isLoading] = useState(false);

	async function handleUpdateSolver({request, quote, solver, ctx}: TUpdateSolverHandler): Promise<void> {
		if (quote.status !== 'fulfilled') {
			return;
		}

		const requestHash = await hash(JSON.stringify({...request, solver, expectedOut: quote.value.raw.toString()}));
		performBatchedUpdates((): void => {
			set_currentSolverState({...ctx, quote: quote.value, hash: requestHash});
			set_isLoading(false);
		});
	}

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we initialize the solver with the required parameters.
	**********************************************************************************************/
	const onUpdateSolver = useCallback(async (): Promise<void> => {
		if (!actionParams?.selectedOptionFrom || !actionParams?.selectedOptionTo || !actionParams?.amount.raw) {
			return;
		}
		set_isLoading(true);

		const request: TInitSolverArgs = {
			from: toAddress(address || ''),
			inputToken: actionParams.selectedOptionFrom,
			outputToken: actionParams.selectedOptionTo,
			inputAmount: actionParams.amount.raw,
			isDepositing: isDepositing
		};

		const isValidSolver = ({quote, solver}: { quote: PromiseSettledResult<TNormalizedBN>; solver: TSolver }): boolean => {
			return quote.status === 'fulfilled' && quote?.value.raw?.gt(0) && !isSolverDisabled[solver];
		};

		switch (currentSolver) {
			case Solver.enum.Wido:
			case Solver.enum.Portals:
			case Solver.enum.Cowswap: {
				const [widoQuote, cowswapQuote, portalsQuote] = await Promise.allSettled([
					wido.init(request, currentSolver === Solver.enum.Wido),
					cowswap.init(request, currentSolver === Solver.enum.Cowswap),
					portals.init(request, currentSolver === Solver.enum.Portals)
				]);

				const solvers: {
					[key in TSolver]?: { quote: PromiseSettledResult<TNormalizedBN>; ctx: TSolverContext };
				} = {};

				[
					{solver: Solver.enum.Wido, quote: widoQuote, ctx: wido},
					{solver: Solver.enum.Cowswap, quote: cowswapQuote, ctx: cowswap},
					{solver: Solver.enum.Portals, quote: portalsQuote, ctx: portals}
				].forEach(({solver, quote, ctx}): void => {
					if (isValidSolver({quote, solver})) {
						solvers[solver] = {quote, ctx};
					}
				});

				solvers[Solver.enum.None] = {quote: {status: 'fulfilled', value: toNormalizedBN(0)}, ctx: vanilla};

				const solverPriority = [Solver.enum.Wido, Solver.enum.Cowswap, Solver.enum.Portals, Solver.enum.None];
				
				const newSolverPriority = [currentSolver, ...solverPriority.filter((solver): boolean => solver !== currentSolver)];

				for (const solver of newSolverPriority) {
					if (!solvers[solver]) {
						continue;
					}

					const result = solvers[solver] ?? solvers[Solver.enum.None];
					if (result) {
						const {quote, ctx} = result;
						await handleUpdateSolver({request, quote, solver, ctx});
					}
					return;
				}

				break;
			}
			case Solver.enum.OptimismBooster: {
				const quote = await optimismBooster.init(request);
				const requestHash = await hash(JSON.stringify({...request, solver: Solver.enum.OptimismBooster, expectedOut: quote.raw.toString()}));
				performBatchedUpdates((): void => {
					set_currentSolverState({...optimismBooster, quote, hash: requestHash});
					set_isLoading(false);
				});
				break;
			}
			case Solver.enum.ChainCoin: {
				const [quote] = await Promise.allSettled([chainCoin.init(request)]);
				await handleUpdateSolver({request, quote, solver: Solver.enum.ChainCoin, ctx: chainCoin});
				break;
			}
			case Solver.enum.PartnerContract: {
				const [quote] = await Promise.allSettled([partnerContract.init(request)]);
				await handleUpdateSolver({request, quote, solver: Solver.enum.PartnerContract, ctx: partnerContract});
				break;
			}
			case Solver.enum.InternalMigration: {
				request.migrator = currentVault.migration.contract;
				const [quote] = await Promise.allSettled([internalMigration.init(request)]);
				await handleUpdateSolver({request, quote, solver: Solver.enum.InternalMigration, ctx: internalMigration});
				break;
			}
			default: {
				const [quote] = await Promise.allSettled([vanilla.init(request)]);
				await handleUpdateSolver({request, quote, solver: Solver.enum.Vanilla, ctx: vanilla});
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [address, actionParams, currentSolver, cowswap.init, vanilla.init, wido.init, internalMigration.init, optimismBooster.init, isDepositing, currentVault.migration.contract]); //Ignore the warning, it's a false positive

	useDebouncedEffect((): void => {
		onUpdateSolver();
	}, [onUpdateSolver], 0);

	const contextValue = useDeepCompareMemo((): TWithSolver => ({
		currentSolver: currentSolver,
		effectiveSolver: currentSolverState?.type,
		expectedOut: currentSolverState?.quote || toNormalizedBN(0),
		hash: currentSolverState?.hash,
		isLoadingExpectedOut: isLoading,
		onRetrieveExpectedOut: currentSolverState.onRetrieveExpectedOut,
		onRetrieveAllowance: currentSolverState.onRetrieveAllowance,
		onApprove: currentSolverState.onApprove,
		onExecuteDeposit: currentSolverState.onExecuteDeposit,
		onExecuteWithdraw: currentSolverState.onExecuteWithdraw
	}), [currentSolver, currentSolverState, isLoading]);

	return (
		<WithSolverContext.Provider value={contextValue}>
			{children}
		</WithSolverContext.Provider>
	);
}


export {WithSolverContextApp};
export const useSolver = (): TWithSolver => useContext(WithSolverContext);
