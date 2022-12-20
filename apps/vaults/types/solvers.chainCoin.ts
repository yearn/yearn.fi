
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the
**	ChainCoin Quote hook`.
**	TChainCoinRequest is the requirement to execute a quote request.
***************************************************************************/
export type TChainCoinRequest = {
    inputToken: TDropdownOption;
    outputToken: TDropdownOption;
	inputAmount: TNormalizedBN;
	isDepositing: boolean;
}
export type TChainCoinAPIRequest = [
    inputToken: TDropdownOption,
    outputToken: TDropdownOption,
	inputAmount: TNormalizedBN,
	isDepositing: boolean
]
export type TChainCoinResult = {
	result: TNormalizedBN,
	isLoading: boolean,
	error: Error | undefined
}