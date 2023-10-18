import {useCallback, useState} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {useGauge} from '@veYFI/contexts/useGauge';
import {approveAndStake, stake, unstake} from '@veYFI/utils/actions/gauge';
import {VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
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
	gaugeApy: number,
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
	const refreshData = (): unknown => Promise.all([refreshGauges(), refreshBalances()]);
	const [approveAndStakeStatus, set_approveAndStakeStatus] = useState(defaultTxStatus);
	const [stakeStatus, set_stakeStatus] = useState(defaultTxStatus);
	const [unstakeStatus, set_unstakeStatus] = useState(defaultTxStatus);
	const userAddress = address as TAddress;

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
	const {gaugeAddresses, gaugesMap, positionsMap, allowancesMap} = useGauge();
	const {vaults} = useYearn();
	const {balances} = useWallet();
	const userAddress = address as TAddress;

	const gaugesData = useDeepCompareMemo((): TGaugeData[] => {
		return (
			gaugeAddresses.map((address): TGaugeData => {
				const gauge = gaugesMap[address];
				const vaultAddress = toAddress(gauge?.vaultAddress);
				const vault = vaults[vaultAddress];

				return ({
					gaugeAddress: address,
					vaultAddress,
					decimals: gauge?.decimals ?? 18,
					vaultIcon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vaultAddress}/logo-128.png`,
					vaultName: vault?.display_name ?? `Vault ${truncateHex(vaultAddress, 4)}`,
					vaultApy: vault?.apy.net_apy ?? 0,
					vaultDeposited: balances[vaultAddress],
					gaugeApy: 0, // TODO: gauge apy calcs
					gaugeBoost: positionsMap[address]?.boost ?? 1,
					gaugeStaked: positionsMap[address]?.deposit ?? toNormalizedBN(0),
					allowance: allowancesMap[allowanceKey(VEYFI_CHAIN_ID, vaultAddress, address, userAddress)],
					isApproved: toBigInt(allowancesMap[allowanceKey(VEYFI_CHAIN_ID, vaultAddress, address, userAddress)]?.raw) >= toBigInt(balances[vaultAddress]?.raw),
					actions: undefined
				});
			})
		);
	}, [gaugesMap, gaugeAddresses, vaults, balances, positionsMap, allowancesMap, userAddress]);


	return (
		<div className={'relative -left-6 w-[calc(100%+48px)]'}>
			<Table
				metadata={[
					{
						key: 'vaultName',
						label: 'Asset',
						columnSpan: 2,
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
						key: 'gaugeApy',
						label: 'Gauge APY',
						sortable: true
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
				data={gaugesData}
				columns={9}
				initialSortBy={'gaugeApy'}
			/>
		</div>
	);
}
