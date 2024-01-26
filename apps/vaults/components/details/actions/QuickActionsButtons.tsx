import {useCallback, useState} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {isZero, toAddress, toBigInt, toNormalizedBN} from '@builtbymom/web3/utils';
import {defaultTxStatus} from '@builtbymom/web3/utils/wagmi';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolver} from '@vaults/contexts/useSolver';
import {useWalletForZap} from '@vaults/contexts/useWalletForZaps';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useYearn} from '@yearn-finance/web-lib/contexts/useYearn';
import {useYearnWallet} from '@yearn-finance/web-lib/contexts/useYearnWallet';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {isEth} from '@yearn-finance/web-lib/utils/isEth';
import {Solver} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokenListBalances';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';

export function VaultDetailsQuickActionsButtons({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {onRefresh} = useYearnWallet();
	const {refresh: refreshZapBalances} = useWalletForZap();
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
			await onRefresh(toRefresh);
		} else if (Solver.enum.Cowswap === currentSolver || Solver.enum.Portals === currentSolver) {
			if (isDepositing) {
				//refresh input from zap wallet, refresh output from default
				await Promise.all([
					refreshZapBalances([{address: toAddress(actionParams?.selectedOptionFrom?.value), chainID}]),
					onRefresh([{address: toAddress(actionParams?.selectedOptionTo?.value), chainID}])
				]);
			} else {
				await Promise.all([
					refreshZapBalances([{address: toAddress(actionParams?.selectedOptionTo?.value), chainID}]),
					onRefresh([{address: toAddress(actionParams?.selectedOptionFrom?.value), chainID}])
				]);
			}
		}
	}, [
		onChangeAmount,
		currentSolver,
		currentVault,
		actionParams?.selectedOptionFrom?.value,
		actionParams?.selectedOptionTo?.value,
		onRefresh,
		isDepositing,
		refreshZapBalances
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
			onClick={async (): Promise<void> => onExecuteWithdraw(set_txStatusExecuteWithdraw, onSuccess)}
			className={'w-full'}
			isBusy={txStatusExecuteWithdraw.pending}
			isDisabled={isButtonDisabled}>
			{'Withdraw'}
		</Button>
	);
}
