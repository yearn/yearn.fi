import {useCallback, useState} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {useGauge} from '@veYFI/contexts/useGauge';
import {useOption} from '@veYFI/contexts/useOption';
import {approveAndStake, stake, unstake} from '@veYFI/utils/actions/gauge';
import {SECONDS_PER_YEAR, VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue, toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {Table} from '@common/components/Table';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

type TGaugeData = {
	gaugeAddress: TAddress,
	vaultAddress: TAddress,
	decimals: number,
	vaultIcon: string,
	vaultName: string,
	vaultApy: number,
	vaultDeposited: TNormalizedBN,
	gaugeAPR: number,
	gaugeBoost: number,
	gaugeStaked: TNormalizedBN,
	allowance: TNormalizedBN,
	isApproved: boolean,
	actions: undefined
}

function GaugeTabButtons({isApproved, vaultAddress, gaugeAddress, vaultDeposited, gaugeStaked}: TGaugeData): ReactElement {
	const {provider, address, isActive} = useWeb3();
	const {refresh: refreshGauges} = useGauge();
	const {refresh: refreshBalances} = useWallet();
	const [approveAndStakeStatus, set_approveAndStakeStatus] = useState(defaultTxStatus);
	const [stakeStatus, set_stakeStatus] = useState(defaultTxStatus);
	const [unstakeStatus, set_unstakeStatus] = useState(defaultTxStatus);
	const userAddress = address as TAddress;
	const refreshData = useCallback((): unknown => Promise.all([refreshGauges(), refreshBalances()]), [refreshGauges, refreshBalances]);

	const onApproveAndStake = useCallback(async (vaultAddress: TAddress, gaugeAddress: TAddress, amount: bigint): Promise<void> => {
		const response = await approveAndStake({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: gaugeAddress,
			vaultAddress,
			amount,
			statusHandler: set_approveAndStakeStatus
		});

		if (response.isSuccessful) {
			await refreshData();
		}
	}, [provider, refreshData]);

	const onStake = useCallback(async (gaugeAddress: TAddress, amount: bigint): Promise<void> => {
		const response = await stake({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: gaugeAddress,
			amount,
			statusHandler: set_stakeStatus
		});

		if (response.isSuccessful) {
			await refreshData();
		}
	}, [provider, refreshData]);

	const onUnstake = useCallback(async (gaugeAddress: TAddress, amount: bigint): Promise<void> => {
		const response = await unstake({
			connector: provider,
			chainID: VEYFI_CHAIN_ID,
			contractAddress: gaugeAddress,
			accountAddress: userAddress,
			amount,
			statusHandler: set_unstakeStatus
		});

		if (response.isSuccessful) {
			await refreshData();
		}
	}, [provider, refreshData, userAddress]);

	return (
		<div className={'flex flex-row justify-center space-x-2 md:justify-end'}>
			<Button
				className={'w-full md:w-24'}
				onClick={async (): Promise<void> => onUnstake(gaugeAddress, toBigInt(gaugeStaked.raw))}
				isDisabled={!isActive || toBigInt(gaugeStaked.raw) == 0n}
				isBusy={unstakeStatus.pending}>
				{'Unstake'}
			</Button>
			{!isApproved && (
				<Button
					className={'w-full md:w-24'}
					onClick={async (): Promise<void> => onApproveAndStake(vaultAddress, gaugeAddress, toBigInt(vaultDeposited?.raw))}
					isDisabled={!isActive || toBigInt(vaultDeposited?.raw) == 0n}
					isBusy={approveAndStakeStatus.pending}>
					{'Approve'}
				</Button>
			)}
			{isApproved && (
				<Button
					className={'w-full md:w-24'}
					onClick={async (): Promise<void> => onStake(gaugeAddress, toBigInt(vaultDeposited?.raw))}
					isDisabled={!isActive || toBigInt(vaultDeposited?.raw) == 0n}
					isBusy={stakeStatus.pending}>
					{'Stake'}
				</Button>
			)}
		</div>
	);
}

export function GaugesTab(): ReactElement {
	const {address} = useWeb3();
	const {gaugesMap, positionsMap, allowancesMap} = useGauge();
	const {vaults, prices} = useYearn();
	const {balances} = useWallet();
	const {dYFIPrice} = useOption();
	const [isLoadingGauges, set_isLoadingGauges] = useState(true);
	const userAddress = address as TAddress;

	const gaugesData = useDeepCompareMemo((): TGaugeData[] => {
		if (!vaults || Object.values(vaults).length === 0) {
			return [];
		}

		const data: TGaugeData[] = [];
		for (const gauge of Object.values(gaugesMap)) {
			if (!gauge) {
				continue;
			}

			const vault = vaults[toAddress(gauge?.vaultAddress)];
			const tokenPrice = formatToNormalizedValue(toBigInt(prices?.[vault.token.address] || 0), 6);
			const boost = Number(positionsMap[gauge.address]?.boost || 1);
			let APRFor10xBoost = Number(gauge?.rewardRate.normalized || 0) * dYFIPrice * SECONDS_PER_YEAR / Number(gauge?.totalStaked.normalized || 0) / tokenPrice * 100;
			if (tokenPrice === 0 || Number(gauge?.totalStaked.normalized || 0) === 0) {
				APRFor10xBoost = 0;
			}

			console.warn(`${Number(gauge?.rewardRate.normalized || 0)} x ${dYFIPrice} x ${SECONDS_PER_YEAR} / ${Number(gauge?.totalStaked.normalized || 0)} / ${tokenPrice} = ${APRFor10xBoost}`);

			// gauge.rewardRate() * dYFI_price * seconds_per_year / gauge.totalAssets() / vault_token_price


			// const APR = rewardRate * 31556952n / totalAssets.raw;
			// console.log(APR)
			// gauge.rewardRate() * seconds_per_year / gauge.totalAssets() / vault_token_price

			data.push({
				gaugeAddress: gauge.address,
				vaultAddress: vault.address,
				decimals: gauge.decimals,
				vaultIcon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vault.address}/logo-128.png`,
				vaultName: vault?.display_name ?? `Vault ${truncateHex(vault.address, 4)}`,
				vaultApy: vault?.apy.net_apy ?? 0,
				vaultDeposited: balances[vault.address],
				gaugeAPR: APRFor10xBoost,
				gaugeBoost: boost,
				gaugeStaked: positionsMap[gauge.address]?.deposit ?? toNormalizedBN(0),
				allowance: allowancesMap[allowanceKey(VEYFI_CHAIN_ID, vault.address, gauge.address, userAddress)],
				isApproved: toBigInt(allowancesMap[allowanceKey(VEYFI_CHAIN_ID, vault.address, gauge.address, userAddress)]?.raw) >= toBigInt(balances[vault.address]?.raw),
				actions: undefined
			});
		}
		set_isLoadingGauges(false);
		return data;
	}, [gaugesMap, vaults, balances, positionsMap, allowancesMap, userAddress]);


	return (
		<div className={'relative -left-6 w-[calc(100%+48px)]'}>
			<Table
				metadata={[
					{
						key: 'vaultName',
						label: 'Asset',
						columnSpan: 3,
						sortable: true,
						fullWidth: true,
						className: 'my-4 md:my-0',
						transform: ({vaultIcon, vaultName}): ReactElement => (
							<div className={'flex flex-row items-center space-x-4 md:space-x-6'}>
								<div className={'flex h-8 min-h-[32px] w-8 min-w-[32px] items-center justify-center rounded-full md:h-10 md:w-10'}>
									<ImageWithFallback
										alt={vaultName}
										width={40}
										height={40}
										quality={90}
										src={vaultIcon}
										loading={'eager'}
									/>
								</div>
								<p>{vaultName}</p>
							</div>
						)
					},
					{
						key: 'vaultApy',
						label: 'Vault APY',
						sortable: true,
						format: ({vaultApy}): string => formatPercent((vaultApy) * 100, 2, 2, 500)
					},
					{
						key: 'vaultDeposited',
						label: 'Deposited',
						sortable: true,
						format: ({vaultDeposited}): string => formatAmount(vaultDeposited?.normalized || 0, 2, 6)
					},
					{
						key: 'gaugeAPR',
						label: 'Gauge APR',
						columnSpan: 2,
						sortable: true,
						className: 'whitespace-break text-right',
						format: ({gaugeAPR}): string => {
							// if (gaugeAPR === 0) {
							// return formatAmount(gaugeAPR, 2, 2);
							// }
							return `${formatAmount(gaugeAPR / 10, 2, 2)}% → ${formatAmount(gaugeAPR, 2, 2)}%`;
						}
					},
					{
						key: 'gaugeBoost',
						label: 'Boost',
						sortable: true,
						format: ({gaugeBoost}): string => `${gaugeBoost.toFixed(2)}x`
					},
					{
						key: 'gaugeStaked',
						label: 'Staked',
						sortable: true,
						className: 'mr-4',
						format: ({gaugeStaked}): string => formatAmount(gaugeStaked?.normalized || 0, 2, 6)
					},
					{
						key: 'actions',
						label: '',
						columnSpan: 2,
						fullWidth: true,
						className: 'my-4 md:my-0',
						transform: (props): ReactElement => <GaugeTabButtons {...props} />
					}
				]}
				isLoading={isLoadingGauges}
				data={gaugesData}
				columns={11}
				initialSortBy={'gaugeAPR'}
			/>
		</div>
	);
}
