import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import * as VotingEscrowActions from '@veYFI/utils/actions/votingEscrow';
import {validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatUnits} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getTimeUntil} from '@yearn-finance/web-lib/utils/time';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

function ClaimTab(): ReactElement {
	const {provider, address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, refresh: refreshVotingEscrow} = useVotingEscrow();
	const refreshData = (): unknown => Promise.all([refreshVotingEscrow(), refreshBalances()]);
	const [withdrawUnlocked, withdrawUnlockedStatus] = useTransaction(VotingEscrowActions.withdrawUnlocked, refreshData);

	const hasLockedAmount = formatBN(positions?.deposit?.underlyingBalance).gt(0);
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions?.unlockTime) : 0;
	const isClaimable = hasLockedAmount && !timeUntilUnlock;
	const claimableAmount = isClaimable ? positions?.deposit?.underlyingBalance : '0';

	const {isValid: isValidNetwork} = validateNetwork({supportedNetwork: 1, walletNetwork: safeChainID});

	return (
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'md:min-h-[104px]'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Claim expired lock'}
					</h2>
					<div className={'mt-6 text-neutral-600'} >
						<p>{'Claim your YFI from expired veYFI lock.'}</p>
					</div>
				</div>
			</div>

			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-2'}>
					<AmountInput
						label={'Unlocked YFI'}
						amount={formatUnits(claimableAmount, 18)}
						disabled />
					<Button
						className={'w-full md:mt-7'}
						onClick={async (): Promise<TTxResponse> => withdrawUnlocked(provider, toAddress(address), toAddress(votingEscrow?.address))}
						isBusy={withdrawUnlockedStatus.loading}
						isDisabled={!isActive || !isValidNetwork || !isClaimable || withdrawUnlockedStatus.loading || !votingEscrow || !address}>
						{'Claim'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {ClaimTab};
