import React, {createContext, useContext, useEffect, useMemo} from 'react';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolverChainCoin} from '@vaults/hooks/useSolverChainCoin';
import {useSolverCowswap} from '@vaults/hooks/useSolverCowswap';
import {useSolverPartnerContract} from '@vaults/hooks/useSolverPartnerContract';
import {useSolverVanilla} from '@vaults/hooks/useSolverVanilla';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {DefaultTNormalizedBN} from '@common/utils';

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
	const currentSolverRef = React.useRef(vanilla);

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we initialize the solver with the required parameters.
	**********************************************************************************************/
	useEffect((): void => {
		switch (currentSolver) {
		case Solvers.COWSWAP:
			cowswap.init({
				from: toAddress(address || ''),
				sellToken: toAddress(selectedOptionFrom?.value),
				buyToken: toAddress(selectedOptionTo?.value),
				sellAmount: amount.raw,
				buyTokenDecimals: Number(selectedOptionTo?.decimals || 18),
				sellTokenDecimals: Number(selectedOptionFrom?.decimals || 18)
			});
			currentSolverRef.current = cowswap;
			break;
		case Solvers.CHAIN_COIN:
			chainCoin.init({
				inputToken: selectedOptionFrom,
				outputToken: selectedOptionTo,
				inputAmount: amount,
				isDepositing: isDepositing
			});
			currentSolverRef.current = chainCoin;
			break;
		case Solvers.PARTNER_CONTRACT:
			chainCoin.init({
				inputToken: selectedOptionFrom,
				outputToken: selectedOptionTo,
				inputAmount: amount,
				isDepositing: isDepositing
			});
			currentSolverRef.current = partnerContract;
			break;
		default:
			vanilla.init({
				inputToken: selectedOptionFrom,
				outputToken: selectedOptionTo,
				inputAmount: amount,
				isDepositing: isDepositing
			});
			currentSolverRef.current = vanilla;
		}
	}, [address, selectedOptionFrom, selectedOptionTo, amount.raw, currentSolver, cowswap.init, vanilla.init, amount, isDepositing]); //Some issues


	const	contextValue = useMemo((): TWithSolver => ({
		currentSolver: currentSolver,
		expectedOut: currentSolverRef.current.quote,
		isLoadingExpectedOut: currentSolverRef.current.isLoadingQuote,
		approve: currentSolverRef.current.approve,
		executeDeposit: currentSolverRef.current.executeDeposit,
		executeWithdraw: currentSolverRef.current.executeWithdraw
	}), [currentSolver]);

	return (
		<WithSolverContext.Provider value={contextValue}>
			{children}
		</WithSolverContext.Provider>
	);
}

export {WithSolverContextApp};
export const useSolver = (): TWithSolver => useContext(WithSolverContext);
