
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the Vanilla
**	Quote hook`.
**	TVanillaRequest is the requirement to execute a quote request.
***************************************************************************/
export type TVanillaAPIRequest = [
    inputToken: TDropdownOption,
    outputToken: TDropdownOption,
	inputAmount: TNormalizedBN,
	isDepositing: boolean
]
export type TVanillaResult = {
	result: TNormalizedBN,
	isLoading: boolean,
	error: Error | undefined
}
