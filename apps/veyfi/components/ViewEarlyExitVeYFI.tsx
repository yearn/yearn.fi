import {useCallback, useState} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {toBigInt, toNormalizedBN} from '@builtbymom/web3/utils';
import {defaultTxStatus} from '@builtbymom/web3/utils/wagmi';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {withdrawLockedVeYFI} from '@veYFI/utils/actions';
import {VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {getTimeUntil, toWeeks} from '@yearn-finance/web-lib/utils/time';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';

export function EarlyExitVeYFI(): ReactElement {
	const {provider, address, isActive} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, refresh: refreshVotingEscrow} = useVotingEscrow();
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions?.unlockTime) : undefined;
	const weeksToUnlock = toNormalizedBN(toWeeks(timeUntilUnlock), 0);
	const hasPenalty = toBigInt(positions?.penalty) > 0n;
	const [withdrawLockedStatus, set_withdrawLockedStatus] = useState(defaultTxStatus);

	const onTxSuccess = useCallback(async (): Promise<void> => {
		await Promise.all([refreshVotingEscrow(), refreshBalances()]);
	}, [refreshBalances, refreshVotingEscrow]);

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

	return (
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 w-full'}>
				<h2 className={'m-0 text-2xl font-bold'}>{'Early exit'}</h2>
				<div className={'mt-6 text-neutral-600'}>
					<p>{'Or you can exit early by paying a penalty based on lock duration.'}</p>
				</div>
			</div>

			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'mt-0 grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-2'}>
					<AmountInput
						label={'veYFI you have'}
						amount={toNormalizedBN(toBigInt(positions?.deposit?.underlyingBalance), 18)}
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
						amount={toNormalizedBN(toBigInt(positions?.withdrawable), 18)}
						legend={`Penalty: ${((positions?.penaltyRatio ?? 0) * 100).toFixed(2)}%`}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={onWithdrawLocked}
						isBusy={withdrawLockedStatus.pending}
						isDisabled={
							!isActive || !hasPenalty || withdrawLockedStatus.pending || !votingEscrow || !address
						}>
						{'Exit'}
					</Button>
				</div>
			</div>
		</div>
	);
}
