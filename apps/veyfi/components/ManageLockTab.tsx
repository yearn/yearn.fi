import {useMemo, useState} from 'react';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import {getVotingPower} from '@veYFI/utils';
import * as VotingEscrowActions from '@veYFI/utils/actions/votingEscrow';
import {MAX_LOCK_TIME, MIN_LOCK_TIME} from '@veYFI/utils/constants';
import {validateAmount} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {formatBN, formatUnits} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {fromWeeks, getTimeUntil, toSeconds, toTime, toWeeks} from '@yearn-finance/web-lib/utils/time';
import {useWallet} from '@common/contexts/useWallet';

import {AmountInput} from '../../common/components/AmountInput';

import type {BigNumber, ethers} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

function ManageLockTab(): ReactElement {
	const [lockTime, set_lockTime] = useState('');
	const {provider, address} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, refresh: refreshVotingEscrow} = useVotingEscrow();
	const refreshData = (): unknown => Promise.all([refreshVotingEscrow(), refreshBalances()]);
	const [extendLockTime, extendLockTimeStatus] = useTransaction(VotingEscrowActions.extendLockTime, refreshVotingEscrow);
	const [withdrawLocked, withdrawLockedStatus] = useTransaction(VotingEscrowActions.withdrawLocked, refreshData);

	const web3Provider = provider as ethers.providers.Web3Provider;
	const userAddress = address as TAddress;
	const hasLockedAmount = formatBN(positions?.deposit?.balance).gt(0);
	const willExtendLock = formatBN(lockTime).gt(0);
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions?.unlockTime) : undefined;
	const weeksToUnlock = timeUntilUnlock ? toWeeks(timeUntilUnlock) : 0;
	const newUnlockTime = toTime(positions?.unlockTime) + fromWeeks(toTime(lockTime));
	const hasPenalty = formatBN(positions?.penalty).gt(0);

	const votingPower = useMemo((): BigNumber => {
		if(!positions?.deposit || !newUnlockTime) {
			return formatBN(0);
		}
		return willExtendLock ? getVotingPower(positions?.deposit?.underlyingBalance,  newUnlockTime) : formatBN(positions?.deposit?.balance);
	}, [positions?.deposit, newUnlockTime, willExtendLock]);
	
	const {isValid: isValidLockTime, error: lockTimeError} = validateAmount({
		amount: lockTime,
		minAmountAllowed: MIN_LOCK_TIME
	});

	const executeExtendLockTime = (): void => {
		if (!votingEscrow || !userAddress) {
			return;
		}
		extendLockTime(
			web3Provider,
			userAddress,
			votingEscrow.address,
			toSeconds(newUnlockTime)
		);
	};
	
	const executeWithdrawLocked = (): void => {
		if (!votingEscrow  || !userAddress) {
			return;
		}
		withdrawLocked(
			web3Provider,
			userAddress,
			votingEscrow.address
		);
	};
	
	return ( 
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'md:min-h-[104px]'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Extend lock'}
					</h2>
					<div className={'mt-6 text-neutral-600'} >
						<p>{'Want to lock for longer? Extend your lock period to increase your gauge boost weight.'}</p>
					</div>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'Current lock period (weeks)'}
						amount={weeksToUnlock}
						disabled
					/>
					<AmountInput
						label={'Increase lock period (weeks)'}
						amount={lockTime}
						onAmountChange={(amount): unknown => set_lockTime(Math.floor(toTime(amount)).toString())}
						maxAmount={MAX_LOCK_TIME - weeksToUnlock > 0 ? MAX_LOCK_TIME - weeksToUnlock : 0}
						disabled={!hasLockedAmount}
						error={lockTimeError}
						legend={'min 1'}
					/>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:pb-5'}>
					<AmountInput
						label={'Total veYFI'}
						amount={formatUnits(votingPower, 18)}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={executeExtendLockTime}
						isBusy={extendLockTimeStatus.loading}
						disabled={!isValidLockTime || extendLockTimeStatus.loading}
					>
						{'Extend'}
					</Button>
				</div>
			</div>

			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'md:min-h-[104px]'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Early exit'}
					</h2>
					<div className={'mt-6 text-neutral-600'} >
						<p>{'Or you can exit early by paying a penalty based on lock duration.'}</p>
					</div>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:pb-5'}>
					<AmountInput
						label={'veYFI you have'}
						amount={formatUnits(positions?.deposit?.balance, 18)}
						disabled
					/>
					<AmountInput
						label={'Current lock time (weeks)'}
						amount={weeksToUnlock}
						disabled
					/>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'YFI you get'}
						amount={formatUnits(positions?.withdrawable, 18)}
						legend={`Penalty: %${((positions?.penaltyRatio ?? 0) * 100).toFixed(4).toString()}`}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={executeWithdrawLocked}
						isBusy={withdrawLockedStatus.loading}
						disabled={!hasPenalty || withdrawLockedStatus.loading}
					>
						{'Exit'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {ManageLockTab};
