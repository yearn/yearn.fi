import React, {createContext, useContext, useEffect, useMemo} from 'react';
import {ethers} from 'ethers';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolverCowswap} from '@vaults/hooks/useSolverCowswap';
import {useSolverVanilla} from '@vaults/hooks/useSolverVanilla';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBigNumberAsAmount, formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

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

const	DefaultTNormalizedBN: TNormalizedBN = {raw: ethers.constants.Zero, normalized: 0};
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
	const {selectedOptionFrom, selectedOptionTo, amount, currentSolver} = useActionFlow();
	const cowswap = useSolverCowswap();
	const vanilla = useSolverVanilla();

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
			break;
		default:
			vanilla.init({
				inputToken: selectedOptionFrom,
				outputToken: selectedOptionTo
			});
		}
	}, [address, selectedOptionFrom, selectedOptionTo, amount.raw, currentSolver, cowswap?.init, vanilla?.init]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we extract the current expectedOut from the solver to be able
	** to display it to the user.
	**********************************************************************************************/
	const expectedOut = useMemo((): TNormalizedBN => {
		if (!selectedOptionTo || !selectedOptionFrom || !amount.raw) {
			return (DefaultTNormalizedBN);
		}

		switch (currentSolver) {
		case Solvers.COWSWAP:
			return ({
				raw: formatBN(cowswap?.quote?.result?.quote?.buyAmount || ethers.constants.Zero),
				normalized: formatBigNumberAsAmount(formatBN(cowswap?.quote?.result?.quote?.buyAmount || 0), selectedOptionTo?.decimals)
			});
		default:
			return (vanilla?.quote?.result || DefaultTNormalizedBN);
		}
	}, [selectedOptionTo, selectedOptionFrom, amount.raw, currentSolver, cowswap?.quote?.result?.quote?.buyAmount, vanilla?.quote?.result]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we need to indicate if we are currently loading the expectedOut
	** from the solver.
	**********************************************************************************************/
	const isLoadingExpectedOut = useMemo((): boolean => {
		if (!selectedOptionTo || !selectedOptionFrom || !amount.raw) {
			return (false);
		}

		switch (currentSolver) {
		case Solvers.COWSWAP:
			return (cowswap?.quote?.isLoading || false);
		default:
			return (vanilla?.quote?.isLoading || false);
		}
	}, [selectedOptionTo, selectedOptionFrom, amount.raw, currentSolver, cowswap?.quote?.isLoading, vanilla?.quote?.isLoading]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we need to use the corresponding approve function.
	**********************************************************************************************/
	const approve = useMemo((): (...props: never) => Promise<boolean> => {
		switch (currentSolver) {
		case Solvers.COWSWAP:
			return (cowswap?.approve);
		default:
			return (vanilla?.approve);
		}
	}, [currentSolver, cowswap?.approve, vanilla?.approve]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we need to use the corresponding deposit function.
	**********************************************************************************************/
	const executeDeposit = useMemo((): (...props: never) => Promise<boolean> => {
		switch (currentSolver) {
		case Solvers.COWSWAP:
			return (cowswap?.execute);
		default:
			return (vanilla?.executeDeposit);
		}
	}, [cowswap?.execute, currentSolver, vanilla?.executeDeposit]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Based on the currentSolver, we need to use the corresponding withdraw function.
	**********************************************************************************************/
	const executeWithdraw = useMemo((): (...props: never) => Promise<boolean> => {
		switch (currentSolver) {
		case Solvers.COWSWAP:
			return (cowswap?.execute);
		default:
			return (vanilla?.executeWithdraw);
		}
	}, [cowswap?.execute, currentSolver, vanilla?.executeWithdraw]);
	
	const	contextValue = useMemo((): TWithSolver => ({
		currentSolver: currentSolver,
		expectedOut,
		isLoadingExpectedOut: isLoadingExpectedOut,
		approve: approve,
		executeDeposit: executeDeposit,
		executeWithdraw: executeWithdraw
	}), [currentSolver, expectedOut, isLoadingExpectedOut, approve, executeDeposit, executeWithdraw]);

	return (
		<WithSolverContext.Provider value={contextValue}>
			{children}
		</WithSolverContext.Provider>
	);
}

export {WithSolverContextApp};
export const useSolver = (): TWithSolver => useContext(WithSolverContext);
