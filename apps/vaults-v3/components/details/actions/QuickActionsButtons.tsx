import {useCallback, useState} from 'react';
import {useRouter} from 'next/router';
import {usePlausible} from 'next-plausible';
import {maxUint256} from 'viem';
import {motion} from 'framer-motion';
import {Button} from '@lib/components/Button';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useAsyncTrigger} from '@lib/hooks/useAsyncTrigger';
import {isZero, toAddress, toBigInt, zeroNormalizedBN} from '@lib/utils';
import {ETH_TOKEN_ADDRESS} from '@lib/utils/constants';
import {defaultTxStatus} from '@lib/utils/wagmi';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolver} from '@vaults/contexts/useSolver';
import {Solver} from '@vaults/types/solvers';
import {useYearn} from '@common/contexts/useYearn';
import {PLAUSIBLE_EVENTS} from '@common/utils/plausible';

import type {ReactElement} from 'react';
import type {TNormalizedBN} from '@lib/types';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';

export function VaultDetailsQuickActionsButtons({
	currentVault,
	hasStakingRewardsLive
}: {
	currentVault: TYDaemonVault;
	hasStakingRewardsLive: boolean;
}): ReactElement {
	const plausible = usePlausible();
	const {onRefresh, isAutoStakingEnabled} = useYearn();
	const {address, provider} = useWeb3();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusExecuteDeposit, set_txStatusExecuteDeposit] = useState(defaultTxStatus);
	const [txStatusExecuteWithdraw, set_txStatusExecuteWithdraw] = useState(defaultTxStatus);
	const [allowanceFrom, set_allowanceFrom] = useState<TNormalizedBN>(zeroNormalizedBN);
	const [allowanceRouter, set_allowanceRouter] = useState<TNormalizedBN>(zeroNormalizedBN);
	const {actionParams, onChangeAmount, maxDepositPossible, isDepositing} = useActionFlow();
	const {pathname} = useRouter();
	const isV3Page = pathname.startsWith(`/v3`);
	const {
		onApprove,
		onExecuteDeposit,
		onExecuteWithdraw,
		onRetrieveAllowance,
		onRetrieveRouterAllowance,
		currentSolver,
		expectedOut,
		isLoadingExpectedOut,
		hash
	} = useSolver();

	/**********************************************************************************************
	 ** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook
	 ** is called when amount/in or out changes. Calls the allowanceFetcher callback.
	 *********************************************************************************************/
	const triggerRetrieveAllowance = useAsyncTrigger(async (): Promise<void> => {
		set_allowanceFrom(await onRetrieveAllowance(true));
		set_allowanceRouter((await onRetrieveRouterAllowance?.(true)) || zeroNormalizedBN);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [address, onRetrieveAllowance, onRetrieveRouterAllowance, hash]);

	/**********************************************************************************************
	 ** The onSuccess callback is called when the deposit or withdraw action is successful. It
	 ** refreshes the vaults, the staking contract if available and the user's wallet balances
	 ** on the from and to tokens.
	 *********************************************************************************************/
	const onSuccess = useCallback(
		async (isDeposit: boolean): Promise<void> => {
			const {chainID} = currentVault;
			if (isDeposit) {
				plausible(PLAUSIBLE_EVENTS.DEPOSIT, {
					props: {
						chainID: currentVault.chainID,
						vaultAddress: currentVault.address,
						vaultSymbol: currentVault.symbol,
						amountToDeposit: actionParams.amount?.display,
						tokenAddress: actionParams?.selectedOptionFrom?.value,
						tokenSymbol: actionParams?.selectedOptionFrom?.symbol,
						isZap: Solver.enum.Cowswap === currentSolver || Solver.enum.Portals === currentSolver,
						action: `Deposit ${actionParams.amount?.display} ${actionParams?.selectedOptionFrom?.symbol} -> ${currentVault.symbol} on chain ${currentVault.chainID}`
					}
				});
			} else {
				plausible(PLAUSIBLE_EVENTS.WITHDRAW, {
					props: {
						chainID: currentVault.chainID,
						vaultAddress: currentVault.address,
						vaultSymbol: currentVault.symbol,
						sharesToWithdraw: actionParams.amount?.display,
						tokenAddress: actionParams?.selectedOptionTo?.value,
						tokenSymbol: actionParams?.selectedOptionTo?.symbol,
						isZap: Solver.enum.Cowswap === currentSolver || Solver.enum.Portals === currentSolver,
						action: `Withdraw ${actionParams.amount?.display} ${currentVault?.symbol} -> ${actionParams?.selectedOptionTo?.symbol} on chain ${actionParams?.selectedOptionTo?.chainID}`
					}
				});
			}

			if (
				Solver.enum.Vanilla === currentSolver ||
				Solver.enum.PartnerContract === currentSolver ||
				Solver.enum.OptimismBooster === currentSolver ||
				Solver.enum.GaugeStakingBooster === currentSolver ||
				Solver.enum.JuicedStakingBooster === currentSolver ||
				Solver.enum.V3StakingBooster === currentSolver ||
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
					onRefresh([{address: toAddress(actionParams?.selectedOptionTo?.value), chainID}]);
				} else {
					onRefresh([{address: toAddress(actionParams?.selectedOptionFrom?.value), chainID}]);
				}
			} else {
				onRefresh([
					{address: toAddress(ETH_TOKEN_ADDRESS), chainID},
					{address: toAddress(actionParams?.selectedOptionFrom?.value), chainID},
					{address: toAddress(actionParams?.selectedOptionTo?.value), chainID}
				]);
			}
			onChangeAmount(zeroNormalizedBN);
		},
		[
			currentVault,
			currentSolver,
			onChangeAmount,
			plausible,
			actionParams.amount?.display,
			actionParams?.selectedOptionFrom?.value,
			actionParams?.selectedOptionFrom?.symbol,
			actionParams?.selectedOptionTo?.value,
			actionParams?.selectedOptionTo?.symbol,
			actionParams?.selectedOptionTo?.chainID,
			onRefresh,
			isDepositing
		]
	);

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
			shouldApproveInfinite ? maxUint256 : toBigInt(actionParams.amount?.raw),
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
		(isDepositing &&
			toBigInt(actionParams.amount?.raw) >
				toBigInt(maxDepositPossible(toAddress(actionParams?.selectedOptionFrom?.value)).raw)) ||
		isLoadingExpectedOut;

	/**********************************************************************************************
	 ** We now need to decide which button to display. Depending on a lot of parameters, we can
	 ** display a button to approve the from token, a button to deposit, a button to withdraw or a
	 ** button to migrate.
	 *********************************************************************************************/
	const isAboveAllowance = toBigInt(actionParams.amount?.raw) > toBigInt(allowanceFrom?.raw);

	if (
		currentVault.version.startsWith('3') &&
		currentVault.migration.available &&
		allowanceRouter?.raw === 0n &&
		(actionParams.amount?.raw ?? 0n) > 0n
	) {
		return (
			<div className={'rounded-md bg-white p-2 text-xs text-black'}>
				{'To enable migrations out of this vault, please ask Yearn to approve the 4626 router!'}
			</div>
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
			currentSolver === Solver.enum.GaugeStakingBooster || // ... or the user is using the Gauge Staking Booster
			currentSolver === Solver.enum.JuicedStakingBooster || // ... or the user is using the Juiced Staking Booster
			currentSolver === Solver.enum.V3StakingBooster) // ... or the user is using the V3 Staking Booster
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
			(currentSolver === Solver.enum.OptimismBooster ||
				currentSolver === Solver.enum.GaugeStakingBooster ||
				currentSolver === Solver.enum.JuicedStakingBooster ||
				currentSolver === Solver.enum.V3StakingBooster) &&
			isAutoStakingEnabled &&
			hasStakingRewardsLive
		) {
			return (
				<Button
					variant={isV3Page ? 'v3' : undefined}
					onClick={async (): Promise<void> =>
						onExecuteDeposit(set_txStatusExecuteDeposit, async () => onSuccess(true))
					}
					className={'w-full whitespace-nowrap'}
					isBusy={txStatusExecuteDeposit.pending}
					isDisabled={
						(!address && !provider) ||
						isZero(toBigInt(actionParams.amount?.raw)) ||
						toBigInt(toBigInt(actionParams.amount?.raw)) >
							toBigInt(maxDepositPossible(toAddress(actionParams?.selectedOptionFrom?.value)).raw)
					}>
					<motion.div
						key={isAutoStakingEnabled ? 'deposit-stake' : 'deposit-only'}
						initial={{opacity: 0, y: 10}}
						animate={{opacity: 1, y: 0}}
						exit={{opacity: 0, y: -10}}
						transition={{duration: 0.3}}>
						{'Deposit and Stake'}
					</motion.div>
				</Button>
			);
		}
		return (
			<Button
				variant={isV3Page ? 'v3' : undefined}
				onClick={async (): Promise<void> =>
					onExecuteDeposit(set_txStatusExecuteDeposit, async () => onSuccess(true))
				}
				className={'w-full'}
				isBusy={txStatusExecuteDeposit.pending}
				isDisabled={isButtonDisabled}>
				<motion.div
					key={isDepositing ? 'deposit' : 'migrate'}
					initial={{opacity: 0, y: 10}}
					animate={{opacity: 1, y: 0}}
					exit={{opacity: 0, y: -10}}
					transition={{duration: 0.3}}>
					{isDepositing ? 'Deposit' : 'Migrate'}
				</motion.div>
			</Button>
		);
	}

	return (
		<Button
			variant={isV3Page ? 'v3' : undefined}
			onClick={async (): Promise<void> =>
				onExecuteWithdraw(set_txStatusExecuteWithdraw, async () => onSuccess(false))
			}
			className={'w-full'}
			isBusy={txStatusExecuteWithdraw.pending}
			isDisabled={isButtonDisabled}>
			{'Withdraw'}
		</Button>
	);
}
