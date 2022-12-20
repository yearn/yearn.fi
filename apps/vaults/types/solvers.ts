
import type {TNormalizedBN} from '@common/types/types';
import type {Solvers} from '@vaults/contexts/useSolver';

/* 🔵 - Yearn Finance ******************************************************
**	Generic type of the WithSolver interface.
**	All solvers should implement this interface.
***************************************************************************/
export type TWithSolver = {
	currentSolver: Solvers;
	expectedOut: TNormalizedBN;
	isLoadingExpectedOut: boolean;
	approve: (...props: never) => Promise<boolean>;
	executeDeposit: (...props: never) => Promise<boolean>;
	executeWithdraw: (...props: never) => Promise<boolean>;
}

export type TSolverContext = {
	quote: TNormalizedBN;
	getQuote: CallableFunction;
	refreshQuote: CallableFunction;
	init: CallableFunction;
	isLoadingQuote: boolean;
	approve: (...props: never) => Promise<boolean>;
	executeDeposit: (...props: never) => Promise<boolean>;
	executeWithdraw: (...props: never) => Promise<boolean>;
}