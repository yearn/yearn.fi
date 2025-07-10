import {Solver} from '@lib/utils/schemas/yDaemonTokenListBalances';

import type {TransactionReceipt} from 'viem';
import type {TAddress, TDropdownOption, TNormalizedBN} from '@lib/types';
import type {TSolver} from '@lib/utils/schemas/yDaemonTokenListBalances';
import type {TTxStatus} from '@lib/utils/wagmi';

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
	onRetrieveRouterAllowance?: (shouldForceRefetch?: boolean) => Promise<TNormalizedBN>;
	onApprove: (
		amount: bigint,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
		onError?: (error?: Error) => Promise<void>
	) => Promise<void>;
	onExecuteDeposit: (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
		onError?: (error?: Error) => Promise<void>
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
	asset?: `0x${string}`;
};

export type TSolverContext = {
	type: TSolver;
	quote: TNormalizedBN | undefined;
	init: (args: TInitSolverArgs, shouldLogError?: boolean) => Promise<TNormalizedBN | undefined>;
	onRetrieveAllowance: (shouldForceRefetch?: boolean) => Promise<TNormalizedBN>;
	onRetrieveRouterAllowance?: (shouldForceRefetch?: boolean) => Promise<TNormalizedBN>;
	onApprove: (
		amount: bigint,
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
		onError?: (error: Error) => Promise<void>
	) => Promise<void>;
	onExecuteDeposit: (
		txStatusSetter: React.Dispatch<React.SetStateAction<TTxStatus>>,
		onSuccess: (receipt?: TransactionReceipt) => Promise<void>,
		onError?: (error: Error) => Promise<void>
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
