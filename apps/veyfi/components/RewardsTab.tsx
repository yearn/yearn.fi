import {useMemo, useState} from 'react';
import {formatUnits} from 'ethers/lib/utils';
import {useGauge} from '@veYFI/contexts/useGauge';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import * as GaugeActions from '@veYFI/utils/actions/gauge';
import {validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {AmountInput} from '@common/components/AmountInput';
import {Dropdown} from '@common/components/Dropdown';
import {useYearn} from '@common/contexts/useYearn';

import type {BigNumber, ethers} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TDropdownOption} from '@common/components/Dropdown';

function RewardsTab(): ReactElement {
	const [selectedGauge, set_selectedGauge] = useState<TDropdownOption>();
	const {provider, address, isActive, chainID} = useWeb3();
	const {gaugeAddresses, gaugesMap, positionsMap, refresh: refreshGauges} = useGauge();
	const {vaults} = useYearn();
	const refreshData = (): unknown => Promise.all([refreshGauges()]);
	const [claim, claimStatus] = useTransaction(GaugeActions.claimRewards, refreshData);
	const [claimAll, claimAllStatus] = useTransaction(GaugeActions.claimAllRewards, refreshData);
	
	const web3Provider = provider as ethers.providers.Web3Provider;
	const userAddress = address as TAddress;
	const selectedGaugeAddress = toAddress(selectedGauge?.key);
	const selectedGaugeRewards = formatBN(positionsMap[selectedGaugeAddress]?.reward.balance);

	const gaugeOptions = gaugeAddresses.map((address): TDropdownOption => {
		const gauge = gaugesMap[address];
		const vaultAddress = toAddress(gauge?.vaultAddress);
		const vault = vaults[vaultAddress];

		return {
			key: address,
			label: vault?.display_name ?? '',
			icon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vaultAddress}/logo-128.png`
		};
	});

	const gaugesRewards = useMemo((): BigNumber => {
		return gaugeAddresses.reduce<BigNumber>((acc, address): BigNumber => {
			return acc.add(formatBN(positionsMap[address]?.reward.balance));
		}, formatBN(0));
	}, [gaugeAddresses, positionsMap]);

	const {isValid: isValidNetwork} = validateNetwork({supportedNetwork: 1, walletNetwork: chainID});

	const onClaim = (): void => {
		claim(web3Provider, userAddress, selectedGaugeAddress);
	};

	const onClaimAll = (): void => {
		claimAll(web3Provider, userAddress, gaugeAddresses, true);
	};

	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col gap-4'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Claim Rewards'}
					</h2>
				</div>

				<div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
					<AmountInput
						label={'Total unclaimed rewards (oYFI)'}
						amount={formatUnits(gaugesRewards, 18)}
						// legend={'≈ $ 420.00'} // TODO: oYFI price calcs
						disabled
					/>
					<Button 
						className={'w-full md:mt-7'}
						onClick={onClaimAll}
						disabled={!isActive || !isValidNetwork || gaugesRewards.eq(0)}
						isBusy={claimAllStatus.loading}
					>
						{'Claim All'}
					</Button>
				</div>
			</div>

			<div className={'flex flex-col gap-4'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Claim Separately'}
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
						label={'Unclaimed rewards (oYFI)'}
						amount={formatUnits(selectedGaugeRewards, 18)}
						// legend={'≈ $ 420.00'} // TODO: oYFI price calcs
						disabled
					/>
					<Button 
						className={'w-full md:mt-7'}
						onClick={onClaim}
						disabled={!isActive || !isValidNetwork || selectedGaugeRewards.eq(0)}
						isBusy={claimStatus.loading}
					>
						{'Claim'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {RewardsTab};
