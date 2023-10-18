import {useCallback, useMemo, useState} from 'react';
import {useGauge} from '@veYFI/contexts/useGauge';
import {useOption} from '@veYFI/contexts/useOption';
import * as GaugeActions from '@veYFI/utils/actions/gauge';
import {VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {AmountInput} from '@common/components/AmountInput';
import {Dropdown} from '@common/components/Dropdown';
import {Input} from '@common/components/Input';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TDropdownOption} from '@common/components/Dropdown';

export function RewardsTab(): ReactElement {
	const [selectedGauge, set_selectedGauge] = useState<TDropdownOption>();
	const {provider, isActive} = useWeb3();
	const {gaugesMap, positionsMap, refresh: refreshGauges} = useGauge();
	const {dYFIPrice} = useOption();
	const {vaults} = useYearn();
	const refreshData = useCallback((): unknown => Promise.all([refreshGauges()]), [refreshGauges]);
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);
	const selectedGaugeAddress = toAddress(selectedGauge?.id);
	const selectedGaugeRewards = positionsMap[selectedGaugeAddress]?.reward ?? toNormalizedBN(0n);

	const onClaim = useCallback(async (): Promise<void> => {
		const result = await GaugeActions.claimRewards({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: selectedGaugeAddress,
			statusHandler: set_claimStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, selectedGaugeAddress]);

	const gaugeOptions = useMemo((): TDropdownOption[] => {
		const options: TDropdownOption[] = [];
		for (const gauge of Object.values(gaugesMap)) {
			if (!gauge || toBigInt(positionsMap[gauge.address]?.reward?.raw) === 0n) {
				continue;
			}
			const vault = vaults[toAddress(gauge?.vaultAddress)];

			options.push({
				id: gauge.address,
				label: vault?.display_name ?? `Vault ${truncateHex(vault.address, 4)}`,
				icon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vault.address}/logo-128.png`
			});
		}
		return options;
	}, [gaugesMap, positionsMap, vaults]);

	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Gauge Rewards'}
					</h2>
					<div className={'text-neutral-600'} >
						<p className={'w-2/3 whitespace-break-spaces'}>
							{'Select a gauge below and claim any dYFI rewards you’re eligible for. Remember, to earn rewards you must stake your Vault token into the corresponding gauge. '}
						</p>
					</div>
				</div>

				<div className={'mt-10 grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<Dropdown
						label={'Gauge'}
						selected={selectedGauge}
						options={gaugeOptions}
						onChange={set_selectedGauge}
					/>
					<AmountInput
						label={'Unclaimed rewards (dYFI)'}
						amount={selectedGaugeRewards}
						legend={formatCounterValue(selectedGaugeRewards.normalized, dYFIPrice)}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={onClaim}
						isDisabled={!isActive || toBigInt(selectedGaugeRewards.raw) === 0n || !claimStatus.none}
						isBusy={claimStatus.pending}>
						{'Claim'}
					</Button>
				</div>
			</div>

			<div className={'h-[1px] w-full bg-neutral-300'} />

			<div className={'flex flex-col opacity-40'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'veYFI boost rewards'}
					</h2>
					<div className={'text-neutral-600'} >
						<p className={'w-2/3 whitespace-break-spaces'}>
							{'These are rewards clawed from the game theoretically suboptimal hands of gauge stakers who farm without a max boost. Their loss is your gain (literally).'}
						</p>
					</div>
				</div>

				<div className={'mt-10 grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<Input
						label={'Unclaimed veYFI boost rewards (dYFI)'}
						value={'Coming soon…'}
						isDisabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={onClaim}
						isDisabled={!isActive || toBigInt(selectedGaugeRewards.raw) === 0n || !claimStatus.none}
						isBusy={claimStatus.pending}>
						{'Claim'}
					</Button>
				</div>
			</div>

			<div className={'h-[1px] w-full bg-neutral-300'} />

			<div className={'flex flex-col opacity-40'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'veYFI exit rewards'}
					</h2>
					<div className={'text-neutral-600'} >
						<p className={'w-2/3 whitespace-break-spaces'}>
							{'When some spaghetti handed locker takes an early exit from their veYFI lock, their penalty is distributed amongst other lockers. It’s like a loyalty bonus, but instead of cheaper groceries you get sweet sweet YFI.'}
						</p>
					</div>
				</div>

				<div className={'mt-10 grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<Input
						label={'Unclaimed veYFI exit rewards (YFI)'}
						value={'Coming soon…'}
						isDisabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={onClaim}
						isDisabled={!isActive || toBigInt(selectedGaugeRewards.raw) === 0n || !claimStatus.none}
						isBusy={claimStatus.pending}>
						{'Claim'}
					</Button>
				</div>
			</div>
		</div>
	);
}

