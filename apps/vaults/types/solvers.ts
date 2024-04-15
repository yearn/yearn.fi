import {Solver} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokenListBalances';

import type {TDropdownOption} from '@yearn-finance/web-lib/types';
import type {TSolver} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokenListBalances';
import type {TAddress, TNormalizedBN} from '@builtbymom/web3/types';
import type {TTxStatus} from '@builtbymom/web3/utils/wagmi';

export {Solver, TSolver};

/* 🔵 - Yearn Finance ******************************************************
 **	Generic type of the WithSolver interface.
 **	All solvers should implement this interface.
 ***************************************************************************/
export type TWithSolver = {
	currentSolver: TSolver;
	effectiveSolver: TSolver;
	expectedOut: TNormalizedBN | undefined;
	hash?: string;
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
};

export type TInitSolverArgs = {
	chainID: number;
	version: string;
	from: TAddress;
	inputToken: TDropdownOption;
	outputToken: TDropdownOption;
	inputAmount: bigint;
	isDepositing: boolean;
	migrator?: TAddress;
	stakingPoolAddress?: TAddress; //Address of the staking pool, for veYFI zap in
};

export type TSolverContext = {
	type: TSolver;
	quote: TNormalizedBN | undefined;
	init: (args: TInitSolverArgs, shouldLogError?: boolean) => Promise<TNormalizedBN | undefined>;
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
};

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
};
export type TVanillaLikeResult = {
	result: TNormalizedBN;
	isLoading: boolean;
	error: Error | undefined;
};
