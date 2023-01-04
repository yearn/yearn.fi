import {useEffect, useMemo, useState} from 'react';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import {getVotingPower} from '@veYFI/utils';
import * as VotingEscrowActions from '@veYFI/utils/actions/votingEscrow';
import {MAX_LOCK_TIME, MIN_LOCK_AMOUNT, MIN_LOCK_TIME} from '@veYFI/utils/constants';
import {formatAmount, toRaw, toUnit} from '@veYFI/utils/format';
import {fromWeeks, getTimeUntil, toSeconds, toTime, toWeeks} from '@veYFI/utils/time';
import {validateAllowance, validateAmount} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {BN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';

import {AmountInput} from '../../common/components/AmountInput';

import type {ethers} from 'ethers';
import type {ReactElement} from 'react';

function LockTab(): ReactElement {
	const [lockAmount, set_lockAmount] = useState('');
	const [lockTime, set_lockTime] = useState('');
	const {provider, address} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, allowances, isLoading: isLoadingVotingEscrow, refresh: refreshVotingEscrow} = useVotingEscrow();
	const tokenBalance = useBalance(toAddress(votingEscrow?.token));
	const refreshData = (): unknown => Promise.all([refreshVotingEscrow(), refreshBalances()]);
	const [approveLock, approveLockStatus] = useTransaction(VotingEscrowActions.approveLock, refreshData);
	const [lock, lockStatus] = useTransaction(VotingEscrowActions.lock, refreshData);
	const [increaseLockAmount, increaseLockAmountStatus] = useTransaction(VotingEscrowActions.increaseLockAmount, refreshData);

	const web3Provider = provider as ethers.providers.Web3Provider;
	const hasLockedAmount = BN(positions?.deposit?.balance).gt(0);
	
	const unlockTime = useMemo((): number => {
		return positions?.unlockTime || Date.now() + fromWeeks(toTime(lockTime));
	}, [positions?.unlockTime, lockTime]);

	const votingPower = useMemo((): string => {
		return getVotingPower(BN(positions?.deposit?.underlyingBalance).add(toRaw(lockAmount, 18)).toString(),  unlockTime);
	}, [positions?.deposit?.underlyingBalance, lockAmount, unlockTime]);

	useEffect((): void => {
		if(!positions?.unlockTime) {
			return;
		}
		set_lockTime(toWeeks(getTimeUntil(positions.unlockTime), false).toString());
	}, [positions?.unlockTime]);

	const {isValid: isApproved} = validateAllowance({
		tokenAddress: votingEscrow?.token ?? '',
		spenderAddress: votingEscrow?.address ?? '',
		allowances,
		amount: toRaw(lockAmount, 18)
	});
	
	const {isValid: isValidLockAmount, error: lockAmountError} = validateAmount({
		amount: lockAmount || '0',
		balance: tokenBalance.normalized.toString(),
		minAmountAllowed: hasLockedAmount ? '0' : MIN_LOCK_AMOUNT.toString(),
		shouldDisplayMin: true
	});
	
	const {isValid: isValidLockTime, error: lockTimeError} = validateAmount({
		amount: lockTime,
		minAmountAllowed: hasLockedAmount ? '0' : MIN_LOCK_TIME.toString()
	});
	
	const executeApprove = (): void => {
		if (!votingEscrow || !address) {
			return;
		}
		approveLock(
			web3Provider,
			address,
			votingEscrow.token,
			votingEscrow.address
		);
	};
	
	const executeLock = (): void => {
		if (!votingEscrow  || !address) {
			return;
		}
		lock(
			web3Provider,
			address,
			votingEscrow.address,
			toRaw(lockAmount, 18),
			toSeconds(unlockTime)
		);
	};
	
	const executeIncreaseLockAmount = (): void => {
		if (!votingEscrow  || !address) {
			return;
		}
		increaseLockAmount(
			web3Provider,
			address,
			votingEscrow.address,
			toRaw(lockAmount, 18)
		);
	};

	const txAction = !isApproved
		? {
			label: 'Approve',
			onAction: executeApprove,
			status: approveLockStatus.loading,
			disabled: isApproved || isLoadingVotingEscrow
		}
		: hasLockedAmount
			? {
				label: 'Lock',
				onAction: executeIncreaseLockAmount,
				status: increaseLockAmountStatus.loading,
				disabled:
					!isApproved ||
					!isValidLockAmount ||
					!isValidLockTime ||
					isLoadingVotingEscrow
			}
			: {
				label: 'Lock',
				onAction: executeLock,
				status: lockStatus.loading,
				disabled:
					!isApproved ||
					!isValidLockAmount ||
					!isValidLockTime ||
					isLoadingVotingEscrow
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
						amount={lockAmount}
						onAmountChange={set_lockAmount}
						maxAmount={tokenBalance.normalized > 0 ? tokenBalance.normalized.toFixed(18) : ''}
						legend={`Available: ${formatAmount(tokenBalance.normalized.toString(), 4)} YFI`}
						error={lockAmountError}
					/>
					<AmountInput
						label={'Current lock period (weeks)'}
						amount={toTime(lockTime) === 0 ? '' : Math.floor(toTime(lockTime)).toString()}
						onAmountChange={set_lockTime}
						maxAmount={(MAX_LOCK_TIME + 1).toString()}
						disabled={hasLockedAmount}
						legend={'min 1'}
						error={lockTimeError}
					/>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'Total veYFI'}
						amount={toUnit(votingPower, 18)}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={txAction.onAction}
						isDisabled={txAction.disabled || txAction.status}
						isBusy={txAction.status}
					>
						{txAction.label}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {LockTab};
