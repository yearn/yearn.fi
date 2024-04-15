import {useCallback, useState} from 'react';
import {useRouter} from 'next/router';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {isEthAddress, isZero, toAddress, toBigInt, zeroNormalizedBN} from '@builtbymom/web3/utils';
import {defaultTxStatus} from '@builtbymom/web3/utils/wagmi';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolver} from '@vaults/contexts/useSolver';
import {useWalletForZap} from '@vaults/contexts/useWalletForZaps';
import {Solver} from '@vaults/types/solvers';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {ETH_TOKEN_ADDRESS, MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';

export function VaultDetailsQuickActionsButtons({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {onRefresh, isAutoStakingEnabled} = useYearn();
	const {refresh: refreshZapBalances} = useWalletForZap();
	const {address, provider} = useWeb3();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusExecuteDeposit, set_txStatusExecuteDeposit] = useState(defaultTxStatus);
	const [txStatusExecuteWithdraw, set_txStatusExecuteWithdraw] = useState(defaultTxStatus);
	const [allowanceFrom, set_allowanceFrom] = useState<TNormalizedBN>(zeroNormalizedBN);
	const {actionParams, onChangeAmount, maxDepositPossible, isDepositing} = useActionFlow();
	const {pathname} = useRouter();
	const isV3Page = pathname.startsWith(`/v3`);
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

	/**********************************************************************************************
	 ** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook
	 ** is called when amount/in or out changes. Calls the allowanceFetcher callback.
	 *********************************************************************************************/
	const triggerRetrieveAllowance = useAsyncTrigger(async (): Promise<void> => {
		set_allowanceFrom(await onRetrieveAllowance(true));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [address, onRetrieveAllowance, hash]);

	/**********************************************************************************************
	 ** The onSuccess callback is called when the deposit or withdraw action is successful. It
	 ** refreshes the vaults, the staking contract if available and the user's wallet balances
	 ** on the from and to tokens.
	 *********************************************************************************************/
	const onSuccess = useCallback(async (): Promise<void> => {
		const {chainID} = currentVault;
		onChangeAmount(zeroNormalizedBN);
		if (
			Solver.enum.Vanilla === currentSolver ||
			Solver.enum.ChainCoin === currentSolver ||
			Solver.enum.PartnerContract === currentSolver ||
			Solver.enum.OptimismBooster === currentSolver ||
			Solver.enum.GaugeStakingBooster === currentSolver ||
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
		} else {
			onRefresh([
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
		onRefresh,
		isDepositing,
		refreshZapBalances
	]);

	/**********************************************************************************************
	 ** Trigger an approve web3 action, simply trying to approve `amount` tokens to be used by the
	 ** Partner contract or the final vault, in charge of depositing the tokens.
	 ** This approve can not be triggered if the wallet is not active (not connected) or if the tx
	 ** is still pending.
	 *********************************************************************************************/
	const onApproveFrom = useCallback(async (): Promise<void> => {
		const shouldApproveInfinite =
			currentSolver === Solver.enum.PartnerContract ||
			currentSolver === Solver.enum.Vanilla ||
			currentSolver === Solver.enum.InternalMigration;
		onApprove(
			shouldApproveInfinite ? MAX_UINT_256 : toBigInt(actionParams.amount?.raw),
			set_txStatusApprove,
			async (): Promise<void> => {
				await triggerRetrieveAllowance();
			}
		);
	}, [actionParams.amount, triggerRetrieveAllowance, currentSolver, onApprove]);

	/**********************************************************************************************
	 ** Define the condition for the button to be disabled. The button is disabled if the user is
	 ** not connected, if the amount is zero, if the amount is above the maximum possible deposit
	 ** or if the expected out is zero.
	 *********************************************************************************************/
	const isButtonDisabled =
		(!address && !provider) ||
		isZero(toBigInt(actionParams.amount?.raw)) ||
		(isDepositing && toBigInt(actionParams.amount?.raw) > toBigInt(maxDepositPossible.raw)) ||
		isLoadingExpectedOut;

	/**********************************************************************************************
	 ** We now need to decide which button to display. Depending on a lot of parameters, we can
	 ** display a button to approve the from token, a button to deposit, a button to withdraw or a
	 ** button to migrate.
	 *********************************************************************************************/
	const isAboveAllowance = toBigInt(actionParams.amount?.raw) > toBigInt(allowanceFrom?.raw);

	// Solver: chainCoin, Action: withdraw
	if (
		isWithdrawing && //If user is withdrawing ...
		currentSolver === Solver.enum.ChainCoin && // ... and the solver is ChainCoin ...
		isEthAddress(actionParams?.selectedOptionTo?.value) && // ... and the output is ETH ...
		isAboveAllowance // ... and the amount is above the allowance
	) {
		// ... then we need to approve the ChainCoin contract
		return (
			<Button
				variant={isV3Page ? 'v3' : undefined}
				className={'w-full'}
				isBusy={txStatusApprove.pending}
				isDisabled={isButtonDisabled || isZero(toBigInt(expectedOut?.raw))}
				onClick={onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	// Solver: chainCoin, Action: deposit
	if (
		isDepositing && //If user is depositing ...
		currentSolver === Solver.enum.ChainCoin // ... and the solver is ChainCoin ...
	) {
		// ... then we can deposit without approval
		return (
			<Button
				variant={isV3Page ? 'v3' : undefined}
				onClick={async (): Promise<void> => onExecuteDeposit(set_txStatusExecuteDeposit, onSuccess)}
				className={'w-full'}
				isBusy={txStatusExecuteDeposit.pending}
				isDisabled={isButtonDisabled}>
				{'Deposit'}
			</Button>
		);
	}

	// Solver: a lot, Action: approve
	if (
		(txStatusApprove.pending || isAboveAllowance) && //If the button is busy or the amount is above the allowance ...
		((isDepositing && currentSolver === Solver.enum.Vanilla) || // ... and the user is depositing with Vanilla ...
			currentSolver === Solver.enum.InternalMigration || // ... or the user is migrating ...
			currentSolver === Solver.enum.Cowswap || // ... or the user is using Cowswap ...
			currentSolver === Solver.enum.Portals || // ... or the user is using Portals ...
			currentSolver === Solver.enum.PartnerContract || // ... or the user is using the Partner contract ...
			currentSolver === Solver.enum.OptimismBooster || // ... or the user is using the Optimism Booster
			currentSolver === Solver.enum.GaugeStakingBooster) // ... or the user is using the Gauge Staking Booster
		// ... then we need to approve the from token
	) {
		return (
			<Button
				variant={isV3Page ? 'v3' : undefined}
				className={'w-full'}
				isBusy={txStatusApprove.pending}
				isDisabled={isButtonDisabled || isZero(toBigInt(expectedOut?.raw))}
				onClick={onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	if (isDepositing || currentSolver === Solver.enum.InternalMigration) {
		if (
			(currentSolver === Solver.enum.OptimismBooster || currentSolver === Solver.enum.GaugeStakingBooster) &&
			isAutoStakingEnabled
		) {
			return (
				<Button
					variant={isV3Page ? 'v3' : undefined}
					onClick={async (): Promise<void> => onExecuteDeposit(set_txStatusExecuteDeposit, onSuccess)}
					className={'w-full whitespace-nowrap'}
					isBusy={txStatusExecuteDeposit.pending}
					isDisabled={
						(!address && !provider) ||
						isZero(toBigInt(actionParams.amount?.raw)) ||
						toBigInt(toBigInt(actionParams.amount?.raw)) > toBigInt(maxDepositPossible.raw)
					}>
					{'Deposit and Stake'}
				</Button>
			);
		}
		return (
			<Button
				variant={isV3Page ? 'v3' : undefined}
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
			variant={isV3Page ? 'v3' : undefined}
			onClick={async (): Promise<void> => onExecuteWithdraw(set_txStatusExecuteWithdraw, onSuccess)}
			className={'w-full'}
			isBusy={txStatusExecuteWithdraw.pending}
			isDisabled={isButtonDisabled}>
			{'Withdraw'}
		</Button>
	);
}
