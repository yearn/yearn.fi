
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TSolver} from '@common/schemas/yDaemonTokenListBalances';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

/* 🔵 - Yearn Finance ******************************************************
**	Generic type of the WithSolver interface.
**	All solvers should implement this interface.
***************************************************************************/
export type TWithSolver = {
	currentSolver: TSolver;
	effectiveSolver: TSolver;
	expectedOut: TNormalizedBN;
	hash?: string,
	isLoadingExpectedOut: boolean;
	onRetrieveAllowance: (shouldForceRefetch?: boolean) => Promise<TNormalizedBN>;
	onApprove: (
		amount: bigint,
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
	inputAmount: bigint
	isDepositing: boolean
	migrator?: TAddress
}

export type TSolverContext = {
	type: TSolver;
	quote: TNormalizedBN;
	init: (args: TInitSolverArgs, shouldLogError?: boolean) => Promise<TNormalizedBN>;
	onRetrieveAllowance: (shouldForceRefetch?: boolean) => Promise<TNormalizedBN>;
	onApprove: (
		amount: bigint,
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
