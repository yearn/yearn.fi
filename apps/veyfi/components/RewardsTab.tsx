import {useCallback, useState} from 'react';
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
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TDropdownOption} from '@common/components/Dropdown';

export function RewardsTab(): ReactElement {
	const [selectedGauge, set_selectedGauge] = useState<TDropdownOption>();
	const {provider, isActive} = useWeb3();
	const {gaugeAddresses, gaugesMap, positionsMap, refresh: refreshGauges} = useGauge();
	const {dYFIPrice} = useOption();
	const {vaults} = useYearn();
	const refreshData = useCallback((): unknown => Promise.all([refreshGauges()]), [refreshGauges]);
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);
	const selectedGaugeAddress = toAddress(selectedGauge?.id);
	const selectedGaugeRewards = toNormalizedBN(toBigInt(positionsMap[selectedGaugeAddress]?.reward?.balance?.raw));

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

	const gaugeOptions = gaugeAddresses.filter((address): boolean => toBigInt(positionsMap[address]?.reward?.balance?.raw) > 0n ?? false)
		.map((address): TDropdownOption => {
			const gauge = gaugesMap[address];
			const vaultAddress = toAddress(gauge?.vaultAddress);
			const vault = vaults[vaultAddress];

			return {
				id: address,
				label: vault?.display_name ?? `Vault ${truncateHex(vaultAddress, 4)}`,
				icon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vaultAddress}/logo-128.png`
			};
		});

	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col gap-4'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Claim Rewards'}
					</h2>
				</div>

				<div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
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
		</div>
	);
}

