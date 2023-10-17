import {useCallback, useState} from 'react';
import {formatUnits} from 'viem';
import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {withdrawUnlockedVeYFI} from '@veYFI/utils/actions';
import {VEYFI_SUPPORTED_NETWORK} from '@veYFI/utils/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getTimeUntil} from '@yearn-finance/web-lib/utils/time';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';

export function ClaimTab(): ReactElement {
	const {provider, address, isActive} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, refresh: refreshVotingEscrow} = useVotingEscrow();
	const [withdrawUnlockedStatus, set_withdrawUnlockedStatus] = useState(defaultTxStatus);
	const hasLockedAmount = toBigInt(positions?.deposit?.underlyingBalance) > 0n;
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions?.unlockTime) : 0;
	const isClaimable = hasLockedAmount && !timeUntilUnlock;
	const claimableAmount = isClaimable ? positions?.deposit?.underlyingBalance : '0';

	const refreshData = useCallback(async (): Promise<void> => {
		await Promise.all([refreshVotingEscrow(), refreshBalances()]);
	}, [refreshVotingEscrow, refreshBalances]);

	const onWithdrawUnlocked = useCallback(async (): Promise<void> => {
		const result = await withdrawUnlockedVeYFI({
			connector: provider,
			chainID: VEYFI_SUPPORTED_NETWORK,
			contractAddress: votingEscrow?.address,
			statusHandler: set_withdrawUnlockedStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, votingEscrow?.address]);

	return (
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'md:min-h-[104px]'}>
					<h2 className={'m-0 text-2xl font-bold'}>{'Claim expired lock'}</h2>
					<div className={'mt-6 text-neutral-600'}>
						<p>{'Claim your YFI from expired veYFI lock.'}</p>
					</div>
				</div>
			</div>

			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-2'}>
					<AmountInput
						label={'Unlocked YFI'}
						amount={formatUnits(toBigInt(claimableAmount), 18)}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={onWithdrawUnlocked}
						isBusy={withdrawUnlockedStatus.pending}
						isDisabled={
							!isActive || !isClaimable || withdrawUnlockedStatus.pending || !votingEscrow || !address
						}>
						{'Claim'}
					</Button>
				</div>
			</div>
		</div>
	);
}
