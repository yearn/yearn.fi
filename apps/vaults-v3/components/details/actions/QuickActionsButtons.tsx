import {useCallback, useState} from 'react';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolver} from '@vaults/contexts/useSolver';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isEth} from '@yearn-finance/web-lib/utils/isEth';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {useAsyncTrigger} from '@common/hooks/useAsyncEffect';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';

import type {ReactElement} from 'react';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

export function VaultDetailsQuickActionsButtons({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {refresh} = useWallet();
	const {address, provider} = useWeb3();
	const {isStakingOpBoostedVaults} = useYearn();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusExecuteDeposit, set_txStatusExecuteDeposit] = useState(defaultTxStatus);
	const [txStatusExecuteWithdraw, set_txStatusExecuteWithdraw] = useState(defaultTxStatus);
	const [allowanceFrom, set_allowanceFrom] = useState<TNormalizedBN>(toNormalizedBN(0));
	const {actionParams, onChangeAmount, maxDepositPossible, isDepositing} = useActionFlow();
	const {
		onApprove,
		onExecuteDeposit,
		onExecuteWithdraw,
		onRetrieveAllowance,
		currentSolver,
		expectedOut,
		isLoadingExpectedOut,
		hash
	} = useSolver();
	const isWithdrawing = !isDepositing;

	/* 🔵 - Yearn Finance **************************************************************************
	 ** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	 ** called when amount/in or out changes. Calls the allowanceFetcher callback.
	 **********************************************************************************************/
	const triggerRetrieveAllowance = useAsyncTrigger(async (): Promise<void> => {
		set_allowanceFrom(await onRetrieveAllowance(true));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [address, onRetrieveAllowance, hash]);

	const onSuccess = useCallback(async (): Promise<void> => {
		const {chainID} = currentVault;
		onChangeAmount(toNormalizedBN(0));
		if (
			Solver.enum.Vanilla === currentSolver ||
			Solver.enum.ChainCoin === currentSolver ||
			Solver.enum.PartnerContract === currentSolver ||
			Solver.enum.OptimismBooster === currentSolver ||
			Solver.enum.InternalMigration === currentSolver
		) {
			const toRefresh = [
				{address: toAddress(actionParams?.selectedOptionFrom?.value), chainID},
				{address: toAddress(actionParams?.selectedOptionTo?.value), chainID},
				{address: toAddress(currentVault.address), chainID}
			];
			if (currentVault.staking.available) {
				toRefresh.push({address: toAddress(currentVault.staking.address), chainID});
			}
			await refresh(toRefresh);
		} else {
			refresh([
				{address: toAddress(ETH_TOKEN_ADDRESS), chainID},
				{address: toAddress(actionParams?.selectedOptionFrom?.value), chainID},
				{address: toAddress(actionParams?.selectedOptionTo?.value), chainID}
			]);
		}
	}, [
		currentVault,
		onChangeAmount,
		currentSolver,
		actionParams?.selectedOptionFrom?.value,
		actionParams?.selectedOptionTo?.value,
		refresh
	]);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Trigger an approve web3 action, simply trying to approve `amount` tokens
	 ** to be used by the Partner contract or the final vault, in charge of
	 ** depositing the tokens.
	 ** This approve can not be triggered if the wallet is not active
	 ** (not connected) or if the tx is still pending.
	 **************************************************************************/
	const onApproveFrom = useCallback(async (): Promise<void> => {
		const shouldApproveInfinite =
			currentSolver === Solver.enum.PartnerContract ||
			currentSolver === Solver.enum.Vanilla ||
			currentSolver === Solver.enum.InternalMigration;
		onApprove(
			shouldApproveInfinite ? MAX_UINT_256 : actionParams?.amount.raw,
			set_txStatusApprove,
			async (): Promise<void> => {
				await triggerRetrieveAllowance();
			}
		);
	}, [actionParams?.amount.raw, triggerRetrieveAllowance, currentSolver, onApprove]);

	const isButtonDisabled =
		(!address && !provider) ||
		isZero(actionParams.amount.raw) ||
		toBigInt(actionParams.amount.raw) > toBigInt(maxDepositPossible.raw) ||
		isLoadingExpectedOut;

	/* 🔵 - Yearn Finance ******************************************************
	 ** Wrapper to decide if we should use the partner contract or not
	 **************************************************************************/
	const isAboveAllowance = toBigInt(actionParams.amount.raw) > toBigInt(allowanceFrom?.raw);

	if (
		isWithdrawing && //If user is withdrawing ...
		currentSolver === Solver.enum.ChainCoin && // ... and the solver is ChainCoin ...
		isEth(actionParams?.selectedOptionTo?.value) && // ... and the output is ETH ...
		isAboveAllowance // ... and the amount is above the allowance
	) {
		// ... then we need to approve the ChainCoin contract
		return (
			<Button
				variant={'v3'}
				className={'w-full'}
				isBusy={txStatusApprove.pending}
				isDisabled={isButtonDisabled || isZero(expectedOut.raw)}
				onClick={onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	if (
		isDepositing && //If user is depositing ...
		currentSolver === Solver.enum.ChainCoin // ... and the solver is ChainCoin ...
	) {
		// ... then we can deposit without approval
		return (
			<Button
				variant={'v3'}
				onClick={async (): Promise<void> => onExecuteDeposit(set_txStatusExecuteDeposit, onSuccess)}
				className={'w-full'}
				isBusy={txStatusExecuteDeposit.pending}
				isDisabled={isButtonDisabled}>
				{'Deposit'}
			</Button>
		);
	}

	if (
		(txStatusApprove.pending || isAboveAllowance) && //If the button is busy or the amount is above the allowance ...
		((isDepositing && currentSolver === Solver.enum.Vanilla) || // ... and the user is depositing with Vanilla ...
			currentSolver === Solver.enum.InternalMigration || // ... or the user is migrating ...
			currentSolver === Solver.enum.Cowswap || // ... or the user is using Cowswap ...
			currentSolver === Solver.enum.Portals || // ... or the user is using Portals ...
			currentSolver === Solver.enum.PartnerContract || // ... or the user is using the Partner contract ...
			currentSolver === Solver.enum.OptimismBooster) // ... or the user is using the Optimism Booster ... // ... then we need to approve the from token
	) {
		return (
			<Button
				variant={'v3'}
				className={'w-full'}
				isBusy={txStatusApprove.pending}
				isDisabled={isButtonDisabled || isZero(expectedOut.raw)}
				onClick={onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	if (isDepositing || currentSolver === Solver.enum.InternalMigration) {
		if (currentSolver === Solver.enum.OptimismBooster && isStakingOpBoostedVaults) {
			return (
				<Button
					variant={'v3'}
					onClick={async (): Promise<void> => onExecuteDeposit(set_txStatusExecuteDeposit, onSuccess)}
					className={'w-full whitespace-nowrap'}
					isBusy={txStatusExecuteDeposit.pending}
					isDisabled={
						(!address && !provider) ||
						isZero(actionParams.amount.raw) ||
						toBigInt(actionParams.amount.raw) > toBigInt(maxDepositPossible.raw)
					}>
					{'Deposit and Stake'}
				</Button>
			);
		}
		return (
			<Button
				variant={'v3'}
				onClick={async (): Promise<void> => onExecuteDeposit(set_txStatusExecuteDeposit, onSuccess)}
				className={'w-full'}
				isBusy={txStatusExecuteDeposit.pending}
				isDisabled={isButtonDisabled}>
				{isDepositing ? 'Deposit' : 'Migrate'}
			</Button>
		);
	}

	return (
		<Button
			variant={'v3'}
			onClick={async (): Promise<void> => onExecuteWithdraw(set_txStatusExecuteWithdraw, onSuccess)}
			className={'w-full'}
			isBusy={txStatusExecuteWithdraw.pending}
			isDisabled={isButtonDisabled}>
			{'Withdraw'}
		</Button>
	);
}
