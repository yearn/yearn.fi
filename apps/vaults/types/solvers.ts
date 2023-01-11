
import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';
import type {Solver} from '@vaults/contexts/useSolver';

/* 🔵 - Yearn Finance ******************************************************
**	Generic type of the WithSolver interface.
**	All solvers should implement this interface.
***************************************************************************/
export type TWithSolver = {
	currentSolver: Solver;
	expectedOut: TNormalizedBN;
	isLoadingExpectedOut: boolean;
	onApprove: (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	) => Promise<void>;
	onExecuteDeposit: (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	) => Promise<void>;
	onExecuteWithdraw: (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	) => Promise<void>;
}

export type TInitSolverArgs = {
	from: TAddress,
	inputToken: TDropdownOption
	outputToken: TDropdownOption
	inputAmount: BigNumber
	isDepositing: boolean
}

export type TSolverContext = {
	quote: TNormalizedBN;
	getQuote: CallableFunction;
	refreshQuote: CallableFunction;
	init: (args: TInitSolverArgs) => Promise<TNormalizedBN>;
	onApprove: (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	) => Promise<void>;
	onExecuteDeposit: (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	) => Promise<void>;
	onExecuteWithdraw: (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: () => Promise<void>
	) => Promise<void>;
}

/* 🔵 - Yearn Finance ******************************************************
**	Theses types are used to define the request and response of the Vanilla,
**	PartnerContract and ChainCoin quote hook.
**	TVanillaRequest is the requirement to execute a quote request.
***************************************************************************/
export type TVanillaLikeRequest = {
	inputToken: TDropdownOption;
	outputToken: TDropdownOption;
	inputAmount: TNormalizedBN;
	isDepositing: boolean;
}
export type TVanillaLikeResult = {
	result: TNormalizedBN,
	isLoading: boolean,
	error: Error | undefined
}
