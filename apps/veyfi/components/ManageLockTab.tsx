import {useCallback, useMemo, useState} from 'react';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {getVotingPower} from '@veYFI/utils';
import {extendVeYFILockTime, withdrawLockedVeYFI} from '@veYFI/utils/actions';
import {MAX_LOCK_TIME, MIN_LOCK_TIME, VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {validateAmount} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {handleInputChangeEventValue} from '@yearn-finance/web-lib/utils/handlers/handleInputChangeEventValue';
import {fromWeeks, getTimeUntil, toSeconds, toTime, toWeeks} from '@yearn-finance/web-lib/utils/time';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';
import type {TNormalizedBN} from '@common/types/types';

export function ManageLockTab(): ReactElement {
	const [lockTime, set_lockTime] = useState<TNormalizedBN>(toNormalizedBN(0, 0));
	const {provider, address, isActive} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, refresh: refreshVotingEscrow} = useVotingEscrow();
	const hasLockedAmount = toBigInt(positions?.deposit?.underlyingBalance) > 0n;
	const willExtendLock = toBigInt(lockTime.raw) > 0n;
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions?.unlockTime) : undefined;
	const weeksToUnlock = toNormalizedBN(toWeeks(timeUntilUnlock), 0);
	const newUnlockTime = toTime(positions?.unlockTime) + fromWeeks(toTime(lockTime.normalized));
	const hasPenalty = toBigInt(positions?.penalty) > 0n;
	const [extendLockTimeStatus, set_extendLockTimeStatus] = useState(defaultTxStatus);
	const [withdrawLockedStatus, set_withdrawLockedStatus] = useState(defaultTxStatus);

	const onTxSuccess = useCallback(async (): Promise<void> => {
		await Promise.all([refreshVotingEscrow(), refreshBalances(), set_lockTime(toNormalizedBN(0, 0))]);
	}, [refreshBalances, refreshVotingEscrow]);

	const onExtendLockTime = useCallback(async (): Promise<void> => {
		const result = await extendVeYFILockTime({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
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
			chainID: VEYFI_CHAIN_ID,
			contractAddress: votingEscrow?.address,
			statusHandler: set_withdrawLockedStatus
		});
		if (result.isSuccessful) {
			onTxSuccess();
		}
	}, [onTxSuccess, provider, votingEscrow?.address]);

	const votingPower = useMemo((): TNormalizedBN => {
		if(!positions?.deposit || !newUnlockTime) {
			return toNormalizedBN(0);
		}
		return toNormalizedBN(willExtendLock ? getVotingPower(positions?.deposit?.underlyingBalance, newUnlockTime) : toBigInt(positions?.deposit?.balance));
	}, [positions?.deposit, newUnlockTime, willExtendLock]);

	const {isValid: isValidLockTime, error: lockTimeError} = validateAmount({
		amount: lockTime.normalized,
		minAmountAllowed: MIN_LOCK_TIME
	});

	const maxTime = MAX_LOCK_TIME - Number(weeksToUnlock?.normalized || 0) > 0 ? MAX_LOCK_TIME - Number(weeksToUnlock?.normalized || 0) : 0;
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
						onAmountChange={(v: string): void => {
							const inputed = handleInputChangeEventValue(v, 0);
							if (Number(inputed.normalized) > maxTime) {
								set_lockTime(toNormalizedBN(maxTime, 0));
							} else {
								set_lockTime(toNormalizedBN(Math.floor(toTime(v)), 0));
							}
						}}
						maxAmount={toNormalizedBN(maxTime, 0)}
						onMaxClick={(): void => set_lockTime(toNormalizedBN(Math.floor(toTime(maxTime)), 0))}
						disabled={!hasLockedAmount}
						error={lockTimeError}
						legend={'Minimum: 1 week'} />
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:pb-5'}>
					<AmountInput
						label={'Total veYFI'}
						amount={votingPower}
						disabled />
					<Button
						className={'w-full md:mt-7'}
						onClick={onExtendLockTime}
						isBusy={extendLockTimeStatus.pending}
						isDisabled={!isActive || !isValidLockTime || extendLockTimeStatus.pending || !votingEscrow || !address}>
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
						amount={toNormalizedBN(toBigInt(positions?.deposit?.underlyingBalance), 18)}
						disabled />
					<AmountInput
						label={'Current lock time (weeks)'}
						amount={weeksToUnlock}
						disabled />
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<AmountInput
						label={'YFI you get'}
						amount={toNormalizedBN(toBigInt(positions?.withdrawable), 18)}
						legend={`Penalty: ${((positions?.penaltyRatio ?? 0) * 100).toFixed(2)}%`}
						disabled />
					<Button
						className={'w-full md:mt-7'}
						onClick={onWithdrawLocked}
						isBusy={withdrawLockedStatus.pending}
						isDisabled={!isActive || !hasPenalty || withdrawLockedStatus.pending || !votingEscrow || !address}>
						{'Exit'}
					</Button>
				</div>
			</div>
		</div>
	);
}
