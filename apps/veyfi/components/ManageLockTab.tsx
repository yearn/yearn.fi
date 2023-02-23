import {useMemo, useState} from 'react';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import {getVotingPower} from '@veYFI/utils';
import * as VotingEscrowActions from '@veYFI/utils/actions/votingEscrow';
import {MAX_LOCK_TIME, MIN_LOCK_TIME} from '@veYFI/utils/constants';
import {validateAmount, validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatUnits} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {fromWeeks, getTimeUntil, toSeconds, toTime, toWeeks} from '@yearn-finance/web-lib/utils/time';
import {useWallet} from '@common/contexts/useWallet';

import {AmountInput} from '../../common/components/AmountInput';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {MaybeBoolean} from '@yearn-finance/web-lib/types';

function ManageLockTab(): ReactElement {
	const [lockTime, set_lockTime] = useState('');
	const {provider, address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, refresh: refreshVotingEscrow} = useVotingEscrow();
	const clearLockTime = (): void => set_lockTime('');
	const refreshData = (): unknown => Promise.all([refreshVotingEscrow(), refreshBalances()]);
	const onTxSuccess = (): unknown => Promise.all([refreshData(), clearLockTime()]);
	const [extendLockTime, extendLockTimeStatus] = useTransaction(VotingEscrowActions.extendLockTime, onTxSuccess);
	const [withdrawLocked, withdrawLockedStatus] = useTransaction(VotingEscrowActions.withdrawLocked, onTxSuccess);

	const hasLockedAmount = formatBN(positions?.deposit?.balance).gt(0);
	const willExtendLock = formatBN(lockTime).gt(0);
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions?.unlockTime) : undefined;
	const weeksToUnlock = toWeeks(timeUntilUnlock);
	const newUnlockTime = toTime(positions?.unlockTime) + fromWeeks(toTime(lockTime));
	const hasPenalty = formatBN(positions?.penalty).gt(0);

	const votingPower = useMemo((): BigNumber => {
		if(!positions?.deposit || !newUnlockTime) {
			return formatBN(0);
		}
		return willExtendLock ? getVotingPower(positions?.deposit?.underlyingBalance, newUnlockTime) : formatBN(positions?.deposit?.balance);
	}, [positions?.deposit, newUnlockTime, willExtendLock]);

	const {isValid: isValidLockTime, error: lockTimeError} = validateAmount({
		amount: lockTime,
		minAmountAllowed: MIN_LOCK_TIME
	});

	const {isValid: isValidNetwork} = validateNetwork({supportedNetwork: 1, walletNetwork: safeChainID});

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
						disabled />
					<AmountInput
						label={'Increase lock period (weeks)'}
						amount={lockTime}
						onAmountChange={(amount): void => set_lockTime(Math.floor(toTime(amount)).toString())}
						maxAmount={MAX_LOCK_TIME - weeksToUnlock > 0 ? MAX_LOCK_TIME - weeksToUnlock : 0}
						onMaxClick={(): void => set_lockTime(Math.floor(toTime(MAX_LOCK_TIME - weeksToUnlock > 0 ? MAX_LOCK_TIME - weeksToUnlock : 0)).toString())}
						disabled={!hasLockedAmount}
						error={lockTimeError}
						legend={'Minimum: 1 week'} />
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:pb-5'}>
					<AmountInput
						label={'Total veYFI'}
						amount={formatUnits(votingPower, 18)}
						disabled />
					<Button
						className={'w-full md:mt-7'}
						onClick={async (): Promise<MaybeBoolean> => extendLockTime(provider, toAddress(address), toAddress(votingEscrow?.address), toSeconds(newUnlockTime))}
						isBusy={extendLockTimeStatus.loading}
						isDisabled={!isActive || !isValidNetwork || !isValidLockTime || extendLockTimeStatus.loading || !votingEscrow || !address}>
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
						disabled />
					<AmountInput
						label={'Current lock time (weeks)'}
						amount={weeksToUnlock}
						disabled />
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'YFI you get'}
						amount={formatUnits(positions?.withdrawable, 18)}
						legend={`Penalty: ${((positions?.penaltyRatio ?? 0) * 100).toFixed(2).toString()}%`}
						disabled />
					<Button
						className={'w-full md:mt-7'}
						onClick={async (): Promise<MaybeBoolean> => withdrawLocked(provider, toAddress(address), toAddress(votingEscrow?.address))}
						isBusy={withdrawLockedStatus.loading}
						isDisabled={!isActive || !isValidNetwork || !hasPenalty || withdrawLockedStatus.loading || !votingEscrow || !address}>
						{'Exit'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {ManageLockTab};
