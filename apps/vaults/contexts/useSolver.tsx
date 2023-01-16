import React, {createContext, useCallback, useContext, useState} from 'react';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolverChainCoin} from '@vaults/hooks/useSolverChainCoin';
import {useSolverCowswap} from '@vaults/hooks/useSolverCowswap';
import {useSolverPartnerContract} from '@vaults/hooks/useSolverPartnerContract';
import {useSolverVanilla} from '@vaults/hooks/useSolverVanilla';
import {useSolverWido} from '@vaults/hooks/useSolverWido';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {Hooks} from '@yearn-finance/web-lib/hooks';
import {useDebouncedEffect} from '@yearn-finance/web-lib/hooks/useDebounce';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {TNormalizedBN} from '@common/types/types';
import type {TWithSolver} from '@vaults/types/solvers';

export enum	Solver {
	VANILLA = 'Vanilla',
	PARTNER_CONTRACT = 'PartnerContract',
	CHAIN_COIN = 'ChainCoin',
	COWSWAP = 'Cowswap',
	WIDO = 'Wido',
	PORTALS = 'Portals'
}

const	DefaultWithSolverContext: TWithSolver = {
	currentSolver: Solver.VANILLA,
	effectiveSolver: Solver.VANILLA,
	expectedOut: toNormalizedBN(0),
	isLoadingExpectedOut: false,
	onRetrieveExpectedOut: async (): Promise<TNormalizedBN> => toNormalizedBN(0),
	onRetrieveAllowance: async (): Promise<TNormalizedBN> => toNormalizedBN(0),
	onApprove: async (): Promise<void> => Promise.resolve(),
	onExecuteDeposit: async (): Promise<void> => Promise.resolve(),
	onExecuteWithdraw: async (): Promise<void> => Promise.resolve()
};

const		WithSolverContext = createContext<TWithSolver>(DefaultWithSolverContext);
function	WithSolverContextApp({children}: {children: React.ReactElement}): React.ReactElement {
	const {address} = useWeb3();
	const {actionParams, currentSolver, isDepositing} = useActionFlow();
	const cowswap = useSolverCowswap();
	const wido = useSolverWido();
	const vanilla = useSolverVanilla();
	const chainCoin = useSolverChainCoin();
	const partnerContract = useSolverPartnerContract();
	const [currentSolverState, set_currentSolverState] = useState(vanilla);
	const [isLoading, set_isLoading] = useState(false);

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we initialize the solver with the required parameters.
	**********************************************************************************************/
	const	onUpdateSolver = useCallback(async (): Promise<void> => {
		if (!actionParams?.selectedOptionFrom || !actionParams?.selectedOptionTo || !actionParams?.amount) {
			return;
		}
		set_isLoading(true);

		let quote: TNormalizedBN = toNormalizedBN(0);
		const request = {
			from: toAddress(address || ''),
			inputToken: actionParams?.selectedOptionFrom,
			outputToken: actionParams?.selectedOptionTo,
			inputAmount: actionParams?.amount.raw,
			isDepositing: isDepositing
		};
		switch (currentSolver) {
			case Solver.WIDO:
			case Solver.COWSWAP: {
				const [widoQuote, cowswapQuote] = await Promise.all([wido.init(request), cowswap.init(request)]);
				console.log({
					cowswap: cowswapQuote?.normalized,
					wido: widoQuote?.normalized
				});

				if (currentSolver === Solver.WIDO) {
					if (widoQuote?.raw?.gt(0)) {
						performBatchedUpdates((): void => {
							set_currentSolverState({...wido, quote: widoQuote});
							set_isLoading(false);
						});
					} else if (cowswapQuote?.raw?.gt(0)) {
						performBatchedUpdates((): void => {
							set_currentSolverState({...cowswap, quote: cowswapQuote});
							set_isLoading(false);
						});
					}
				}

				if (currentSolver === Solver.COWSWAP) {
					if (cowswapQuote?.raw?.gt(0)) {
						performBatchedUpdates((): void => {
							set_currentSolverState({...cowswap, quote: cowswapQuote});
							set_isLoading(false);
						});
					} else if (widoQuote?.raw?.gt(0)) {
						performBatchedUpdates((): void => {
							set_currentSolverState({...wido, quote: widoQuote});
							set_isLoading(false);
						});
					}

				}
				break;
			}
			// case Solver.COWSWAP:
			// 	quote = await cowswap.init(request);
			// 	performBatchedUpdates((): void => {
			// 		set_currentSolverState({...cowswap, quote});
			// 		set_isLoading(false);
			// 	});
			// 	break;
			case Solver.CHAIN_COIN:
				quote = await chainCoin.init(request);
				performBatchedUpdates((): void => {
					set_currentSolverState({...chainCoin, quote});
					set_isLoading(false);
				});
				break;
			case Solver.PARTNER_CONTRACT:
				quote = await partnerContract.init(request);
				performBatchedUpdates((): void => {
					set_currentSolverState({...partnerContract, quote});
					set_isLoading(false);
				});
				break;
			default:
				quote = await vanilla.init(request);
				performBatchedUpdates((): void => {
					set_currentSolverState({...vanilla, quote});
					set_isLoading(false);
				});
		}
	}, [address, actionParams, currentSolver, cowswap.init, vanilla.init, wido.init, isDepositing]); //Ignore the warning, it's a false positive

	useDebouncedEffect((): void => {
		onUpdateSolver();
	}, [onUpdateSolver], 0);

	const	contextValue = Hooks.useDeepCompareMemo((): TWithSolver => ({
		currentSolver: currentSolver,
		effectiveSolver: currentSolverState?.type,
		expectedOut: currentSolverState?.quote || toNormalizedBN(0),
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
