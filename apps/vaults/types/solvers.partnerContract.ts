
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the
**	PartnerContract Quote hook`.
**	TPartnerContractRequest is the requirement to execute a quote request.
***************************************************************************/
export type TPartnerContractRequest = {
    inputToken: TDropdownOption;
    outputToken: TDropdownOption;
	inputAmount: TNormalizedBN;
	isDepositing: boolean;
}
export type TPartnerContractAPIRequest = [
    inputToken: TDropdownOption,
    outputToken: TDropdownOption,
	inputAmount: TNormalizedBN,
	isDepositing: boolean
]
export type TPartnerContractResult = {
	result: TNormalizedBN,
	isLoading: boolean,
	error: Error | undefined
}