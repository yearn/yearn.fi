import {useVotingEscrow} from '@veYFI/contexts/useVotingEscrow';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import * as VotingEscrowActions from '@veYFI/utils/actions/votingEscrow';
import {validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {formatBN, formatUnits} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getTimeUntil} from '@yearn-finance/web-lib/utils/time';
import {AmountInput} from '@common/components/AmountInput';
import {useWallet} from '@common/contexts/useWallet';

import type {ethers} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

function ClaimTab(): ReactElement {
	const {provider, address, isActive, chainID} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {votingEscrow, positions, refresh: refreshVotingEscrow} = useVotingEscrow();
	const refreshData = (): unknown => Promise.all([refreshVotingEscrow(), refreshBalances()]);
	const [withdrawUnlocked, withdrawUnlockedStatus] = useTransaction(VotingEscrowActions.withdrawUnlocked, refreshData);

	const web3Provider = provider as ethers.providers.Web3Provider;
	const userAddress = address as TAddress;
	const hasLockedAmount = formatBN(positions?.deposit?.balance).gt(0);
	const timeUntilUnlock = positions?.unlockTime ? getTimeUntil(positions?.unlockTime) : 0;
	const isClaimable = hasLockedAmount && !timeUntilUnlock;
	const claimableAmount = isClaimable ? positions?.deposit?.balance : '0';

	const {isValid: isValidNetwork} = validateNetwork({supportedNetwork: 1, walletNetwork: chainID});

	const executeWithdrawUnlocked = (): void => {
		if (!votingEscrow || !address) {
			return;
		}
		withdrawUnlocked(web3Provider, userAddress, votingEscrow.address);
	};

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
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={executeWithdrawUnlocked}
						isBusy={withdrawUnlockedStatus.loading}
						disabled={!isActive || !isValidNetwork || !isClaimable || withdrawUnlockedStatus.loading}
					>
						{'Claim'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {ClaimTab};
