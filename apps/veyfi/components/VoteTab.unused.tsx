import {useCallback, useState} from 'react';
import Link from 'next/link';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {toAddress} from '@builtbymom/web3/utils';
import {defaultTxStatus} from '@builtbymom/web3/utils/wagmi';
import {delegateVote} from '@veYFI/utils/actions/votingEscrow';
import {SNAPSHOT_DELEGATE_REGISTRY_ADDRESS, VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {validateAddress} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Input} from '@common/components/Input';

import type {ReactElement} from 'react';

export function VoteTab(): ReactElement {
	const [delegateAddress, set_delegateAddress] = useState('');
	const {provider, address, isActive} = useWeb3();
	const [delegateVoteStatus, set_delegateVoteStatus] = useState(defaultTxStatus);
	const {isValid: isValidDelegateAddress, error: delegateAddressError} = validateAddress({address: delegateAddress});

	const onHandleExecuteDelegateVote = useCallback(async (): Promise<void> => {
		if (!address || !isValidDelegateAddress) {
			return;
		}

		await delegateVote({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: SNAPSHOT_DELEGATE_REGISTRY_ADDRESS,
			statusHandler: set_delegateVoteStatus,
			delegateAddress: toAddress(delegateAddress)
		});
	}, [delegateAddress, isValidDelegateAddress, provider, address]);

	return (
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 grid w-full gap-8'}>
				<div className={'flex flex-col gap-6 md:min-h-[104px]'}>
					<h2 className={'m-0 text-2xl font-bold'}>{'Vote for Gauge'}</h2>
					<div className={'text-neutral-600'}>
						<p>{'Vote to direct future YFI rewards to a particular gauge.'}</p>
						<br />
						<p>
							{
								'If you prefer your democracy on the representative side, you can delegate your vote to another address.'
							}
						</p>
					</div>
				</div>

				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<Link
						className={'w-full md:w-auto'}
						href={'https://snapshot.org/#/veyfi.eth'}
						target={'_blank'}>
						<Button className={'w-full'}>{'Vote on Snapshot'}</Button>
					</Link>
				</div>

				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<Input
						label={'Delegate to'}
						value={delegateAddress}
						onChange={set_delegateAddress}
						placeholder={'0x...'}
						error={delegateAddressError}
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={onHandleExecuteDelegateVote}
						isBusy={delegateVoteStatus.pending}
						isDisabled={!isActive || !isValidDelegateAddress || delegateVoteStatus.pending}>
						{'Submit'}
					</Button>
				</div>
			</div>
		</div>
	);
}
