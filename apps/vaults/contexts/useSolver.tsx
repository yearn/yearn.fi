import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolverChainCoin} from '@vaults/hooks/useSolverChainCoin';
import {useSolverCowswap} from '@vaults/hooks/useSolverCowswap';
import {useSolverPartnerContract} from '@vaults/hooks/useSolverPartnerContract';
import {useSolverVanilla} from '@vaults/hooks/useSolverVanilla';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {DefaultTNormalizedBN} from '@common/utils';

import type {TNormalizedBN} from '@common/types/types';
import type {TWithSolver} from '@vaults/types/solvers';

export enum	Solvers {
	VANILLA = 'vanilla',
	PARTNER_CONTRACT = 'partnerContract',
	CHAIN_COIN = 'chainCoin',
	COWSWAP = 'cowswap',
	WIDO = 'wido',
	PORTALS = 'portals'
}

const	DefaultWithSolverContext: TWithSolver = {
	currentSolver: Solvers.VANILLA,
	expectedOut: DefaultTNormalizedBN,
	isLoadingExpectedOut: false,
	approve: async (): Promise<boolean> => Promise.resolve(false),
	executeDeposit: async (): Promise<boolean> => Promise.resolve(false),
	executeWithdraw: async (): Promise<boolean> => Promise.resolve(false)
};

const		WithSolverContext = createContext<TWithSolver>(DefaultWithSolverContext);
function	WithSolverContextApp({children}: {children: React.ReactElement}): React.ReactElement {
	const {address} = useWeb3();
	const {selectedOptionFrom, selectedOptionTo, amount, currentSolver, isDepositing} = useActionFlow();
	const cowswap = useSolverCowswap();
	const vanilla = useSolverVanilla();
	const chainCoin = useSolverChainCoin();
	const partnerContract = useSolverPartnerContract();
	const [currentSolverState, set_currentSolverState] = useState(vanilla);
	const [isLoading, set_isLoading] = useState(false);

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we initialize the solver with the required parameters.
	**********************************************************************************************/
	const	onUpdateSolver = useCallback(async (): Promise<void> => {
		set_isLoading(true);
		if (!selectedOptionFrom || !selectedOptionTo || !amount) {
			return;
		}

		let quote: TNormalizedBN = DefaultTNormalizedBN;
		switch (currentSolver) {
		case Solvers.COWSWAP:
			quote = await cowswap.init({
				from: toAddress(address || ''),
				inputToken: selectedOptionFrom,
				outputToken: selectedOptionTo,
				inputAmount: amount.raw,
				isDepositing: isDepositing
			});
			performBatchedUpdates((): void => {
				set_currentSolverState({...cowswap, quote});
				set_isLoading(false);
			});
			break;
		case Solvers.CHAIN_COIN:
			quote = await chainCoin.init({
				from: toAddress(address || ''),
				inputToken: selectedOptionFrom,
				outputToken: selectedOptionTo,
				inputAmount: amount.raw,
				isDepositing: isDepositing
			});
			performBatchedUpdates((): void => {
				set_currentSolverState({...chainCoin, quote});
				set_isLoading(false);
			});
			break;
		case Solvers.PARTNER_CONTRACT:
			quote = await partnerContract.init({
				from: toAddress(address || ''),
				inputToken: selectedOptionFrom,
				outputToken: selectedOptionTo,
				inputAmount: amount.raw,
				isDepositing: isDepositing
			});
			performBatchedUpdates((): void => {
				set_currentSolverState({...partnerContract, quote});
				set_isLoading(false);
			});
			break;
		default:
			quote = await vanilla.init({
				from: toAddress(address || ''),
				inputToken: selectedOptionFrom,
				outputToken: selectedOptionTo,
				inputAmount: amount.raw,
				isDepositing: isDepositing
			});
			performBatchedUpdates((): void => {
				set_currentSolverState({...vanilla, quote});
				set_isLoading(false);
			});
		}
	}, [address, selectedOptionFrom, selectedOptionTo, amount.raw, currentSolver, cowswap.init, vanilla.init, amount, isDepositing]); //Some issues

	useEffect((): void => {
		onUpdateSolver();
	}, [onUpdateSolver]);


	const	contextValue = useMemo((): TWithSolver => ({
		currentSolver: currentSolver,
		expectedOut: currentSolverState?.quote || DefaultTNormalizedBN,
		isLoadingExpectedOut: isLoading,
		approve: currentSolverState.approve,
		executeDeposit: currentSolverState.executeDeposit,
		executeWithdraw: currentSolverState.executeWithdraw
	}), [currentSolver, currentSolverState, isLoading]);

	return (
		<WithSolverContext.Provider value={contextValue}>
			{children}
		</WithSolverContext.Provider>
	);
}

export {WithSolverContextApp};
export const useSolver = (): TWithSolver => useContext(WithSolverContext);
