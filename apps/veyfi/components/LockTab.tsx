import {useEffect, useMemo, useState} from 'react';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import {getVotingPower} from '@veYFI/utils';
import * as VotingEscrowActions from '@veYFI/utils/actions/votingEscrow';
import {MAX_LOCK_TIME, MIN_LOCK_AMOUNT, MIN_LOCK_TIME} from '@veYFI/utils/constants';
import {validateAllowance, validateAmount, validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatUnits, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {fromWeeks, getTimeUntil, toSeconds, toTime, toWeeks} from '@yearn-finance/web-lib/utils/time';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {MaybeBoolean} from '@yearn-finance/web-lib/types';
import type {TMilliseconds} from '@yearn-finance/web-lib/utils/time';

function LockTab(): ReactElement {
	const [lockAmount, set_lockAmount] = useState(toNormalizedBN(0));
	const [lockTime, set_lockTime] = useState('');
	const {provider, address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, allowances, isLoading: isLoadingVotingEscrow, refresh: refreshVotingEscrow} = useVotingEscrow();
	const tokenBalance = useBalance(toAddress(votingEscrow?.token));
	const clearLockAmount = (): void => set_lockAmount(toNormalizedBN(0));
	const refreshData = (): unknown => Promise.all([refreshVotingEscrow(), refreshBalances()]);
	const onTxSuccess = (): unknown => Promise.all([refreshData(), clearLockAmount()]);
	const [approveLock, approveLockStatus] = useTransaction(VotingEscrowActions.approveLock, refreshData);
	const [lock, lockStatus] = useTransaction(VotingEscrowActions.lock, onTxSuccess);
	const [increaseLockAmount, increaseLockAmountStatus] = useTransaction(VotingEscrowActions.increaseLockAmount, onTxSuccess);

	const hasLockedAmount = formatBN(positions?.deposit?.balance).gt(0);

	const unlockTime = useMemo((): TMilliseconds => {
		return positions?.unlockTime || Date.now() + fromWeeks(toTime(lockTime));
	}, [positions?.unlockTime, lockTime]);

	const votingPower = useMemo((): BigNumber => {
		return getVotingPower(formatBN(positions?.deposit?.underlyingBalance).add(lockAmount.raw), unlockTime);
	}, [positions?.deposit?.underlyingBalance, lockAmount, unlockTime]);

	useEffect((): void => {
		if(!positions?.unlockTime) {
			return;
		}
		set_lockTime(toWeeks(getTimeUntil(positions.unlockTime), false).toString());
	}, [positions?.unlockTime]);

	const {isValid: isApproved} = validateAllowance({
		tokenAddress: toAddress(votingEscrow?.token),
		spenderAddress: toAddress(votingEscrow?.address),
		allowances,
		amount: lockAmount.raw
	});

	const {isValid: isValidLockAmount, error: lockAmountError} = validateAmount({
		amount: lockAmount.normalized,
		balance: tokenBalance.normalized,
		minAmountAllowed: hasLockedAmount ? 0 : MIN_LOCK_AMOUNT,
		shouldDisplayMin: !hasLockedAmount
	});

	const {isValid: isValidLockTime, error: lockTimeError} = validateAmount({
		amount: lockTime,
		minAmountAllowed: hasLockedAmount ? 0 : MIN_LOCK_TIME
	});

	const {isValid: isValidNetwork} = validateNetwork({supportedNetwork: 1, walletNetwork: safeChainID});

	const isApproveDisabled = !isActive || !isValidNetwork || isApproved || isLoadingVotingEscrow || !votingEscrow || !address;
	const isLockDisabled = !isActive || !isValidNetwork || !isApproved || !isValidLockAmount || !isValidLockTime || isLoadingVotingEscrow || !votingEscrow || !address;
	const txAction = !isApproved
		? {
			label: 'Approve',
			onAction: async (): Promise<MaybeBoolean> => approveLock(provider, toAddress(address), toAddress(votingEscrow?.token), toAddress(votingEscrow?.address)),
			isLoading: approveLockStatus.loading,
			isDisabled: isApproveDisabled
		}
		: hasLockedAmount
			? {
				label: 'Lock',
				onAction: async (): Promise<MaybeBoolean> => increaseLockAmount(provider, toAddress(address), toAddress(votingEscrow?.address), lockAmount.raw),
				isLoading: increaseLockAmountStatus.loading,
				isDisabled: isLockDisabled
			}
			: {
				label: 'Lock',
				onAction: async (): Promise<MaybeBoolean> => lock(provider, toAddress(address), toAddress(votingEscrow?.address), lockAmount.raw, toSeconds(unlockTime)),
				isLoading: lockStatus.loading,
				isDisabled: isLockDisabled
			};

	return (
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 w-full'}>
				<h2 className={'m-0 text-2xl font-bold'}>
					{"YFI holders, time to Lock' ‘N Load"}
				</h2>
				<div className={'mt-6 text-neutral-600'} >
					<p >{'Lock your YFI for veYFI to take part in Yearn governance.'}</p>
					<br />
					<p>{'Please note, governance is currently the only use for veYFI until the full platform launches ‘soon’. Stay tuned anon.'}</p>
				</div>
			</div>

			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'mt-0 grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-2'}>
					<AmountInput
						label={'YFI'}
						amount={lockAmount.normalized}
						maxAmount={formatAmount(tokenBalance.normalized, 0, 6)}
						onAmountChange={(amount): void => set_lockAmount(handleInputChangeEventValue(amount, 18))}
						onLegendClick={(): void => set_lockAmount(tokenBalance)}
						onMaxClick={(): void => set_lockAmount(tokenBalance)}
						legend={`Available: ${formatAmount(tokenBalance.normalized, 4)} YFI`}
						error={lockAmountError} />
					<AmountInput
						label={'Current lock period (weeks)'}
						amount={toTime(lockTime) === 0 ? '' : Math.floor(toTime(lockTime)).toString()}
						onAmountChange={set_lockTime}
						maxAmount={(MAX_LOCK_TIME + 1).toString()}
						onMaxClick={(): void => set_lockTime((MAX_LOCK_TIME + 1).toString())}
						disabled={hasLockedAmount}
						legend={'Minimum: 1 week'}
						error={lockTimeError} />
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'Total veYFI'}
						amount={formatUnits(votingPower, 18)}
						disabled />
					<Button
						className={'w-full md:mt-7'}
						onClick={txAction.onAction}
						isDisabled={txAction.isDisabled || txAction.isLoading}
						isBusy={txAction.isLoading}>
						{txAction.label}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {LockTab};
