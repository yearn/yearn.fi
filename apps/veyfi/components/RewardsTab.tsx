import {useCallback, useMemo, useState} from 'react';
import {useGauge} from '@veYFI/contexts/useGauge';
import {useOption} from '@veYFI/contexts/useOption';
import {YFI_REWARD_POOL_ABI} from '@veYFI/utils/abi/YFIRewardPool.abi';
import * as GaugeActions from '@veYFI/utils/actions/gauge';
import {VEYFI_CHAIN_ID, VEYFI_DYFI_REWARD_POOL, VEYFI_YFI_REWARD_POOL} from '@veYFI/utils/constants';
import {prepareWriteContract} from '@wagmi/core';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {isZeroAddress, toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {AmountInput} from '@common/components/AmountInput';
import {Dropdown} from '@common/components/Dropdown';
import {useYearn} from '@common/contexts/useYearn';
import {useAsyncTrigger} from '@common/hooks/useAsyncEffect';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {ReactElement} from 'react';
import type {TDropdownOption} from '@common/components/Dropdown';
import type {TNormalizedBN} from '@common/types/types';

function GaugeRewards(): ReactElement {
	const [selectedGauge, set_selectedGauge] = useState<TDropdownOption>();
	const {provider, isActive} = useWeb3();
	const {gaugesMap, userPositionInGauge, refresh: refreshGauges} = useGauge();
	const {dYFIPrice} = useOption();
	const {vaults} = useYearn();
	const refreshData = useCallback((): unknown => Promise.all([refreshGauges()]), [refreshGauges]);
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);
	const selectedGaugeAddress = toAddress(selectedGauge?.id);
	const selectedGaugeRewards = userPositionInGauge[selectedGaugeAddress]?.reward ?? toNormalizedBN(0n);

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
			if (!gauge || toBigInt(userPositionInGauge[gauge.address]?.reward?.raw) === 0n) {
				continue;
			}
			const vault = vaults[toAddress(gauge?.vaultAddress)];

			options.push({
				id: gauge.address,
				label: vault?.name ?? `Vault ${truncateHex(vault.address, 4)}`,
				icon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vault.address}/logo-128.png`
			});
		}
		return options;
	}, [gaugesMap, userPositionInGauge, vaults]);

	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<div className={'flex flex-col'}>
				<div className={'flex flex-col gap-4'}>
					<h2 className={'m-0 text-2xl font-bold'}>{'Gauge Rewards'}</h2>
					<div className={'text-neutral-600'}>
						<p className={'w-2/3 whitespace-break-spaces'}>
							{
								'Select a gauge below and claim any dYFI rewards you’re eligible for. Remember, to earn rewards you must stake your Vault token into the corresponding gauge. '
							}
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
		</div>
	);
}

function BoostRewards(): ReactElement {
	const {isActive, provider, address} = useWeb3();
	const {dYFIPrice} = useOption();
	const [claimable, set_claimable] = useState<TNormalizedBN>(toNormalizedBN(0));
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);

	const onRefreshClaimable = useAsyncTrigger(async (): Promise<void> => {
		if (isZeroAddress(address)) {
			set_claimable(toNormalizedBN(0));
			return;
		}
		try {
			const {result} = await prepareWriteContract({
				chainId: VEYFI_CHAIN_ID,
				address: VEYFI_DYFI_REWARD_POOL,
				abi: YFI_REWARD_POOL_ABI,
				functionName: 'claim',
				account: address
			});
			set_claimable(toNormalizedBN(result, 18));
		} catch (error) {
			console.warn(`[err - BoostRewards]: static call reverted when trying to get claimable amount.`);
			set_claimable(toNormalizedBN(0));
		}
	}, [address, isActive, provider]); // eslint-disable-line react-hooks/exhaustive-deps

	const onClaim = useCallback(async (): Promise<void> => {
		const result = await GaugeActions.claimBoostRewards({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: VEYFI_DYFI_REWARD_POOL,
			statusHandler: set_claimStatus
		});
		if (result.isSuccessful) {
			onRefreshClaimable();
		}
	}, [provider, onRefreshClaimable]);

	return (
		<div className={'flex flex-col'}>
			<div className={'flex flex-col gap-4'}>
				<h2 className={'m-0 text-2xl font-bold'}>{'veYFI boost rewards'}</h2>
				<div className={'text-neutral-600'}>
					<p className={'w-2/3 whitespace-break-spaces'}>
						{
							'These are rewards clawed from the game theoretically suboptimal hands of gauge stakers who farm without a max boost. Their loss is your gain (literally).'
						}
					</p>
				</div>
			</div>

			<div className={'mt-10 grid grid-cols-1 gap-4 md:grid-cols-4'}>
				<AmountInput
					label={'Unclaimed veYFI boost rewards (dYFI)'}
					amount={claimable}
					legend={formatCounterValue(claimable.normalized, dYFIPrice)}
					disabled
				/>
				<Button
					className={'w-full md:mt-7'}
					onClick={onClaim}
					isDisabled={isZeroAddress(address) || toBigInt(claimable.raw) === 0n || !claimStatus.none}
					isBusy={claimStatus.pending}>
					{'Claim'}
				</Button>
			</div>
		</div>
	);
}

function ExitRewards(): ReactElement {
	const {provider, address} = useWeb3();
	const yfiPrice = useTokenPrice(YFI_ADDRESS);
	const [claimable, set_claimable] = useState<TNormalizedBN>(toNormalizedBN(0));
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);

	const onRefreshClaimable = useAsyncTrigger(async (): Promise<void> => {
		if (isZeroAddress(address)) {
			set_claimable(toNormalizedBN(0));
			return;
		}
		try {
			const {result} = await prepareWriteContract({
				chainId: VEYFI_CHAIN_ID,
				address: VEYFI_YFI_REWARD_POOL,
				abi: YFI_REWARD_POOL_ABI,
				functionName: 'claim',
				account: address
			});
			set_claimable(toNormalizedBN(result, 18));
		} catch (error) {
			console.warn(error);
			console.error(`[err - ExitRewards]: static call reverted when trying to get claimable amount.`);
			set_claimable(toNormalizedBN(0));
		}
	}, [address]);

	const onClaim = useCallback(async (): Promise<void> => {
		const result = await GaugeActions.claimBoostRewards({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: VEYFI_YFI_REWARD_POOL,
			statusHandler: set_claimStatus
		});
		if (result.isSuccessful) {
			onRefreshClaimable();
		}
	}, [provider, onRefreshClaimable]);

	return (
		<div className={'flex flex-col'}>
			<div className={'flex flex-col gap-4'}>
				<h2 className={'m-0 text-2xl font-bold'}>{'veYFI exit rewards'}</h2>
				<div className={'text-neutral-600'}>
					<p className={'w-2/3 whitespace-break-spaces'}>
						{
							'When some spaghetti handed locker takes an early exit from their veYFI lock, their penalty is distributed amongst other lockers. It’s like a loyalty bonus, but instead of cheaper groceries you get sweet sweet YFI.'
						}
					</p>
				</div>
			</div>

			<div className={'mt-10 grid grid-cols-1 gap-4 md:grid-cols-4'}>
				<AmountInput
					label={'Unclaimed veYFI exit rewards (YFI)'}
					amount={claimable}
					legend={formatCounterValue(claimable.normalized, yfiPrice)}
					disabled
				/>
				<Button
					className={'w-full md:mt-7'}
					onClick={onClaim}
					isDisabled={isZeroAddress(address) || toBigInt(claimable.raw) === 0n || !claimStatus.none}
					isBusy={claimStatus.pending}>
					{'Claim'}
				</Button>
			</div>
		</div>
	);
}

export function RewardsTab(): ReactElement {
	return (
		<div className={'flex flex-col gap-6 md:gap-10'}>
			<GaugeRewards />

			<div className={'h-[1px] w-full bg-neutral-300'} />

			<BoostRewards />

			<div className={'h-[1px] w-full bg-neutral-300'} />

			<ExitRewards />
		</div>
	);
}
