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
import {hash} from '@common/utils';

import type {MaybeString} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@common/types/types';
import type {TInitSolverArgs, TSolverContext, TWithSolver} from '@vaults/types/solvers';

export enum Solver {
	VANILLA = 'Vanilla',
	PARTNER_CONTRACT = 'PartnerContract',
	CHAIN_COIN = 'ChainCoin',
	INTERNAL_MIGRATION = 'InternalMigration',
	OPTIMISM_BOOSTER = 'OptimismBooster',
	COWSWAP = 'Cowswap',
	WIDO = 'Wido',
	PORTALS = 'Portals',
	NONE = 'None'
}

export const isSolverDisabled = {
	[Solver.VANILLA]: false,
	[Solver.PARTNER_CONTRACT]: false,
	[Solver.CHAIN_COIN]: false,
	[Solver.INTERNAL_MIGRATION]: false,
	[Solver.COWSWAP]: false,
	[Solver.OPTIMISM_BOOSTER]: false,
	[Solver.WIDO]: false,
	[Solver.PORTALS]: false,
	[Solver.NONE]: false
};

type TUpdateSolverHandler = {
	request: TInitSolverArgs;
	quote: PromiseSettledResult<TNormalizedBN>;
	solver: Solver;
	ctx: TSolverContext;
}

const DefaultWithSolverContext: TWithSolver = {
	currentSolver: Solver.VANILLA,
	effectiveSolver: Solver.VANILLA,
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

		const isValidSolver = ({quote, solver}: { quote: PromiseSettledResult<TNormalizedBN>; solver: Solver }): boolean => {
			return quote.status === 'fulfilled' && quote?.value.raw?.gt(0) && !isSolverDisabled[solver];
		};

		switch (currentSolver) {
			case Solver.WIDO:
			case Solver.PORTALS:
			case Solver.COWSWAP: {
				const [widoQuote, cowswapQuote, portalsQuote] = await Promise.allSettled([
					wido.init(request, currentSolver === Solver.WIDO),
					cowswap.init(request, currentSolver === Solver.COWSWAP),
					portals.init(request, currentSolver === Solver.PORTALS)
				]);

				const solvers: {
					[key in Solver]?: { quote: PromiseSettledResult<TNormalizedBN>; ctx: TSolverContext };
				} = {};

				[
					{solver: Solver.WIDO, quote: widoQuote, ctx: wido},
					{solver: Solver.COWSWAP, quote: cowswapQuote, ctx: cowswap},
					{solver: Solver.PORTALS, quote: portalsQuote, ctx: portals}
				].forEach(({solver, quote, ctx}): void => {
					if (isValidSolver({quote, solver})) {
						solvers[solver] = {quote, ctx};
					}
				});

				solvers[Solver.NONE] = {quote: {status: 'fulfilled', value: toNormalizedBN(0)}, ctx: vanilla};

				const solverPriority = [Solver.WIDO, Solver.COWSWAP, Solver.PORTALS, Solver.NONE];
				
				const newSolverPriority = [currentSolver, ...solverPriority.filter((solver): boolean => solver !== currentSolver)];

				for (const solver of newSolverPriority) {
					if (!solvers[solver]) {
						continue;
					}

					const {quote, ctx} = solvers[solver] ?? solvers[Solver.NONE];
					await handleUpdateSolver({request, quote, solver, ctx});
					return;
				}

				break;
			}
			case Solver.OPTIMISM_BOOSTER: {
				const quote = await optimismBooster.init(request);
				const requestHash = await hash(JSON.stringify({...request, solver: Solver.OPTIMISM_BOOSTER, expectedOut: quote.raw.toString()}));
				performBatchedUpdates((): void => {
					set_currentSolverState({...optimismBooster, quote, hash: requestHash});
					set_isLoading(false);
				});
				break;
			}
			case Solver.CHAIN_COIN: {
				const [quote] = await Promise.allSettled([chainCoin.init(request)]);
				await handleUpdateSolver({request, quote, solver: Solver.CHAIN_COIN, ctx: chainCoin});
				break;
			}
			case Solver.PARTNER_CONTRACT: {
				const [quote] = await Promise.allSettled([partnerContract.init(request)]);
				await handleUpdateSolver({request, quote, solver: Solver.PARTNER_CONTRACT, ctx: partnerContract});
				break;
			}
			case Solver.INTERNAL_MIGRATION: {
				request.migrator = currentVault.migration.contract;
				const [quote] = await Promise.allSettled([internalMigration.init(request)]);
				await handleUpdateSolver({request, quote, solver: Solver.INTERNAL_MIGRATION, ctx: internalMigration});
				break;
			}
			default: {
				const [quote] = await Promise.allSettled([vanilla.init(request)]);
				await handleUpdateSolver({request, quote, solver: Solver.VANILLA, ctx: vanilla});
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
