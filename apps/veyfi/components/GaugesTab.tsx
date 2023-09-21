import {useCallback, useState} from 'react';
import {useGauge} from '@veYFI/contexts/useGauge';
import * as GaugeActions from '@veYFI/utils/actions/gauge';
import {validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBigNumberAsAmount, toBigInt, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {Table} from '@common/components/Table';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

type TGaugeData = {
	gaugeAddress: TAddress;
	vaultAddress: TAddress;
	decimals: number;
	vaultIcon: string;
	vaultName: string;
	vaultApy: number;
	vaultDeposited: bigint;
	gaugeApy: number;
	gaugeBoost: number;
	gaugeStaked: bigint;
	allowance: bigint;
	isApproved: boolean;
	actions: undefined;
};

export function GaugesTab(): ReactElement {
	const [selectedGauge, set_selectedGauge] = useState('');
	const [selectedAction, set_selectedAction] = useState<'stake' | 'unstake' | undefined>();
	const {provider, address, isActive, chainID} = useWeb3();
	const {gaugeAddresses, gaugesMap, positionsMap, allowancesMap, refresh: refreshGauges, isLoading: isLoadingGauges} = useGauge();
	const {vaults} = useYearn();
	const {getBalance, refresh: refreshBalances} = useWallet();
	const refreshData = (): unknown => Promise.all([refreshGauges(), refreshBalances()]);
	const [approveAndStakeStatus, set_approveAndStakeStatus] = useState(defaultTxStatus);
	const [stakeStatus, set_stakeStatus] = useState(defaultTxStatus);
	const [unstakeStatus, set_unstakeStatus] = useState(defaultTxStatus);
	const userAddress = address as TAddress;

	const gaugesData = gaugeAddresses.map((address): TGaugeData => {
		const gauge = gaugesMap[address];
		const vaultAddress = toAddress(gauge?.vaultAddress);
		const vault = vaults[vaultAddress];
		const vaultBalance = getBalance({address: vaultAddress, chainID: vault.chainID});

		return {
			gaugeAddress: address,
			vaultAddress,
			decimals: gauge?.decimals ?? 18,
			vaultIcon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vaultAddress}/logo-128.png`,
			vaultName: vault?.display_name ?? '',
			vaultApy: vault?.apr.netAPR ?? 0,
			vaultDeposited: toBigInt(formatBigNumberAsAmount(vaultBalance.raw)),
			gaugeApy: 0, // TODO: gauge apy calcs
			gaugeBoost: positionsMap[address]?.boost ?? 1,
			gaugeStaked: toBigInt(formatBigNumberAsAmount(positionsMap[address]?.deposit.balance)),
			allowance: toBigInt(formatBigNumberAsAmount(allowancesMap[allowanceKey(vault.chainID, vaultAddress, address, userAddress)])),
			isApproved:
				toBigInt(formatBigNumberAsAmount(allowancesMap[allowanceKey(vault.chainID, vaultAddress, address, userAddress)])) >=
				toBigInt(formatBigNumberAsAmount(vaultBalance.raw)),
			actions: undefined
		};
	});

	const {isValid: isValidNetwork} = validateNetwork({
		supportedNetwork: 1,
		walletNetwork: chainID
	});

	const onApproveAndStake = useCallback(
		async (vaultAddress: TAddress, gaugeAddress: TAddress, amount: bigint): Promise<void> => {
			set_selectedGauge(gaugeAddress);
			set_selectedAction('stake');
			const response = await GaugeActions.approveAndStake({
				connector: provider,
				contractAddress: gaugeAddress,
				vaultAddress,
				amount,
				statusHandler: set_approveAndStakeStatus
			});

			if (response.isSuccessful) {
				await refreshData();
			}
		},
		[provider, refreshData]
	);

	const onStake = useCallback(
		async (gaugeAddress: TAddress, amount: bigint): Promise<void> => {
			set_selectedGauge(gaugeAddress);
			set_selectedAction('stake');

			const response = await GaugeActions.stake({
				connector: provider,
				contractAddress: gaugeAddress,
				amount,
				statusHandler: set_stakeStatus
			});

			if (response.isSuccessful) {
				await refreshData();
			}
		},
		[provider, refreshData]
	);

	const onUnstake = useCallback(
		async (gaugeAddress: TAddress, amount: bigint): Promise<void> => {
			set_selectedGauge(gaugeAddress);
			set_selectedAction('unstake');

			const response = await GaugeActions.unstake({
				connector: provider,
				contractAddress: gaugeAddress,
				accountAddress: userAddress,
				amount,
				statusHandler: set_unstakeStatus
			});

			if (response.isSuccessful) {
				await refreshData();
			}
		},
		[provider, refreshData, userAddress]
	);

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
						format: ({vaultApy}): string => formatPercent(vaultApy * 100, 2, 2, 500)
					},
					{
						key: 'vaultDeposited',
						label: 'Deposited in Vault',
						sortable: true,
						format: ({vaultDeposited, decimals}): string => formatAmount(toNormalizedValue(vaultDeposited, decimals))
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
						label: 'Staked in Gauge',
						sortable: true,
						format: ({gaugeStaked, decimals}): string => formatAmount(toNormalizedValue(gaugeStaked, decimals))
					},
					{
						key: 'actions',
						label: '',
						columnSpan: 2,
						fullWidth: true,
						className: 'my-4 md:my-0',
						transform: ({isApproved, vaultAddress, gaugeAddress, vaultDeposited, gaugeStaked}): ReactElement => (
							<div className={'flex flex-row justify-center space-x-2 md:justify-end'}>
								<Button
									className={'w-full md:w-24'}
									onClick={async (): Promise<void> => onUnstake(gaugeAddress, gaugeStaked)}
									isDisabled={!isActive || !isValidNetwork || isZero(gaugeStaked)}
									isBusy={gaugeAddress === selectedGauge && selectedAction === 'unstake' && unstakeStatus.none}>
									{'Unstake'}
								</Button>
								{!isApproved && (
									<Button
										className={'w-full md:w-24'}
										onClick={async (): Promise<void> => onApproveAndStake(vaultAddress, gaugeAddress, vaultDeposited)}
										isDisabled={!isActive || !isValidNetwork || isZero(vaultDeposited)}
										isBusy={
											(isLoadingGauges && vaultDeposited > 0n) || (gaugeAddress === selectedGauge && selectedAction === 'stake' && approveAndStakeStatus.none)
										}>
										{'Stake'}
									</Button>
								)}
								{isApproved && (
									<Button
										className={'w-full md:w-24'}
										onClick={async (): Promise<void> => onStake(gaugeAddress, vaultDeposited)}
										isDisabled={!isActive || !isValidNetwork || isZero(vaultDeposited)}
										isBusy={(isLoadingGauges && vaultDeposited > 0n) || (gaugeAddress === selectedGauge && selectedAction === 'stake' && stakeStatus.none)}>
										{'Stake'}
									</Button>
								)}
							</div>
						)
					}
				]}
				data={gaugesData}
				columns={9}
				initialSortBy={'gaugeApy'}
			/>
		</div>
	);
}
