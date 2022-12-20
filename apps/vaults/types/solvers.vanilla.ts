
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the Vanilla
**	Quote hook`.
**	TVanillaRequest is the requirement to execute a quote request.
***************************************************************************/
export type TVanillaRequest = {
    inputToken: TDropdownOption;
    outputToken: TDropdownOption;
}
export type TVanillaResult = {
	result: TNormalizedBN,
	isLoading: boolean,
	error: Error | undefined
}

export type TVanillaSolverContext = {
	quote: TVanillaResult;
	getQuote: CallableFunction;
	refreshQuote: CallableFunction;
	init: CallableFunction;
	approve: (...props: never) => Promise<boolean>;
	executeDeposit: (...props: never) => Promise<boolean>;
	executeWithdraw: (...props: never) => Promise<boolean>;
}