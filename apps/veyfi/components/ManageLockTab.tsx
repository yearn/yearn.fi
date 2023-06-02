import {useCallback, useMemo, useState} from 'react';
import {formatUnits} from 'viem';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {getVotingPower} from '@veYFI/utils';
import {extendVeYFILockTime, withdrawLockedVeYFI} from '@veYFI/utils/actions';
import {MAX_LOCK_TIME, MIN_LOCK_TIME} from '@veYFI/utils/constants';
import {validateAmount, validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {fromWeeks, getTimeUntil, toSeconds, toTime, toWeeks} from '@yearn-finance/web-lib/utils/time';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';

function ManageLockTab(): ReactElement {
	const [lockTime, set_lockTime] = useState('');
	const {provider, address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, refresh: refreshVotingEscrow} = useVotingEscrow();
	const hasLockedAmount = toBigInt(positions?.deposit?.underlyingBalance) > 0n;
	const willExtendLock = toBigInt(lockTime) > 0n;
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions?.unlockTime) : undefined;
	const weeksToUnlock = toWeeks(timeUntilUnlock);
	const newUnlockTime = toTime(positions?.unlockTime) + fromWeeks(toTime(lockTime));
	const hasPenalty = toBigInt(positions?.penalty) > 0n;
	const [extendLockTimeStatus, set_extendLockTimeStatus] = useState(defaultTxStatus);
	const [withdrawLockedStatus, set_withdrawLockedStatus] = useState(defaultTxStatus);

	const onTxSuccess = useCallback(async (): Promise<void> => {
		await Promise.all([refreshVotingEscrow(), refreshBalances(), set_lockTime('')]);
	}, [refreshBalances, refreshVotingEscrow]);

	const onExtendLockTime = useCallback(async (): Promise<void> => {
		const result = await extendVeYFILockTime({
			connector: provider,
			contractAddress: votingEscrow?.address,
			time: toBigInt(toSeconds(newUnlockTime)),
			statusHandler: set_extendLockTimeStatus
		});
		if (result.isSuccessful) {
			onTxSuccess();
		}
	}, [newUnlockTime, onTxSuccess, provider, votingEscrow?.address]);

	const onWithdrawLocked = useCallback(async (): Promise<void> => {
		const result = await withdrawLockedVeYFI({
			connector: provider,
			contractAddress: votingEscrow?.address,
			statusHandler: set_withdrawLockedStatus
		});
		if (result.isSuccessful) {
			onTxSuccess();
		}
	}, [onTxSuccess, provider, votingEscrow?.address]);

	const votingPower = useMemo((): bigint => {
		if(!positions?.deposit || !newUnlockTime) {
			return 0n;
		}
		return willExtendLock ? getVotingPower(positions?.deposit?.underlyingBalance, newUnlockTime) : toBigInt(positions?.deposit?.balance);
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
						onClick={onExtendLockTime}
						isBusy={extendLockTimeStatus.pending}
						isDisabled={!isActive || !isValidNetwork || !isValidLockTime || extendLockTimeStatus.pending || !votingEscrow || !address}>
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
						amount={formatUnits(toBigInt(positions?.deposit?.balance), 18)}
						disabled />
					<AmountInput
						label={'Current lock time (weeks)'}
						amount={weeksToUnlock}
						disabled />
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'YFI you get'}
						amount={formatUnits(toBigInt(positions?.withdrawable), 18)}
						legend={`Penalty: ${((positions?.penaltyRatio ?? 0) * 100).toFixed(2)}%`}
						disabled />
					<Button
						className={'w-full md:mt-7'}
						onClick={onWithdrawLocked}
						isBusy={withdrawLockedStatus.pending}
						isDisabled={!isActive || !isValidNetwork || !hasPenalty || withdrawLockedStatus.pending || !votingEscrow || !address}>
						{'Exit'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {ManageLockTab};
