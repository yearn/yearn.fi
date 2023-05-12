import React, {createContext, useCallback, useContext, useState} from 'react';
import {useDebouncedEffect, useDeepCompareMemo} from '@react-hookz/web';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolverChainCoin} from '@vaults/hooks/useSolverChainCoin';
import {useSolverCowswap} from '@vaults/hooks/useSolverCowswap';
import {useSolverInternalMigration} from '@vaults/hooks/useSolverInternalMigration';
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
	[Solver.WIDO]: false,
	[Solver.PORTALS]: false,
	[Solver.NONE]: false
};

type TUpdateSolverHandler = {
	request: TInitSolverArgs;
	quote: PromiseSettledResult<TNormalizedBN>;
	solver: Solver;
	solverCtx: TSolverContext;
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
	const [currentSolverState, set_currentSolverState] = useState<TSolverContext & { hash: MaybeString }>({...vanilla, hash: undefined});
	const [isLoading, set_isLoading] = useState(false);

	async function handleUpdateSolver({request, quote, solver, solverCtx}: TUpdateSolverHandler): Promise<void> {
		if (quote.status !== 'fulfilled' ) {
			return;
		}
		
		const requestHash = await hash(JSON.stringify({...request, solver, expectedOut: quote.value.raw.toString()}));
		performBatchedUpdates((): void => {
			set_currentSolverState({...solverCtx, quote: quote.value, hash: requestHash});
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

		const isValidSolver = ({quote, solver}: {quote: PromiseSettledResult<TNormalizedBN>; solver: Solver}): boolean => {
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

				const solverPriority = [Solver.WIDO, Solver.COWSWAP, Solver.PORTALS, Solver.VANILLA];

				const solvers = {} as any;

				if (isValidSolver({quote: widoQuote, solver: Solver.WIDO})) {
					solvers[Solver.WIDO] = [widoQuote, Solver.WIDO, wido];
				}

				if (isValidSolver({quote: cowswapQuote, solver: Solver.COWSWAP})) {
					solvers[Solver.COWSWAP] = [cowswapQuote, Solver.COWSWAP, cowswap];
				}

				if (isValidSolver({quote: portalsQuote, solver: Solver.PORTALS})) {
					solvers[Solver.PORTALS] = [portalsQuote, Solver.PORTALS, portals];
				}

				solvers[Solver.VANILLA] = [{status: 'fulfilled', value: toNormalizedBN(0)}, Solver.NONE, vanilla];

				const newSolverPriority = [currentSolver, ...solverPriority.filter((solver): boolean => solver !== currentSolver)];

				for (const currentSolver of newSolverPriority) {
					if (!solvers[currentSolver]) {
						continue;
					}

					const [quote, solver, solverCtx] = solvers[currentSolver];
					await handleUpdateSolver({request, quote, solver, solverCtx});
					return;
				}

				break;
			}

			case Solver.CHAIN_COIN: {
				const quote = await chainCoin.init(request);
				await handleUpdateSolver({
					request,
					quote: {
						status: 'fulfilled',
						value: quote
					},
					solver: Solver.CHAIN_COIN,
					solverCtx: chainCoin
				});
				break;
			}
			case Solver.PARTNER_CONTRACT: {
				const quote = await partnerContract.init(request);
				await handleUpdateSolver({
					request,
					quote:{
						status: 'fulfilled',
						value: quote
					},
					solver: Solver.PARTNER_CONTRACT,
					solverCtx: partnerContract
				});
				break;
			}
			case Solver.INTERNAL_MIGRATION: {
				request.migrator = currentVault.migration.contract;
				const quote = await internalMigration.init(request);
				await handleUpdateSolver({
					request,
					quote:{
						status: 'fulfilled',
						value: quote
					},
					solver: Solver.INTERNAL_MIGRATION,
					solverCtx: internalMigration
				});
				break;
			}
			default: {
				const quote = await vanilla.init(request);
				await handleUpdateSolver({
					request,
					quote: {
						status: 'fulfilled',
						value: quote
					},
					solver: Solver.VANILLA,
					solverCtx: vanilla
				});
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [address, actionParams, currentSolver, cowswap.init, vanilla.init, wido.init, internalMigration.init, isDepositing, currentVault.migration.contract]); //Ignore the warning, it's a false positive

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
