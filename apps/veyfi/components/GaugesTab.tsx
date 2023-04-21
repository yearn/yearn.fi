import {useState} from 'react';
import {useGauge} from '@veYFI/contexts/useGauge';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import * as GaugeActions from '@veYFI/utils/actions/gauge';
import {validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {Table} from '@common/components/Table';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';

import type {BigNumber, ethers} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

type TGaugeData = {
	gaugeAddress: TAddress,
	vaultAddress: TAddress,
	decimals: number,
	vaultIcon: string,
	vaultName: string,
	vaultApy: number,
	vaultDeposited: BigNumber,
	gaugeApy: number,
	gaugeBoost: number,
	gaugeStaked: BigNumber,
	allowance: BigNumber,
	isApproved: boolean,
	actions: undefined
}

function GaugesTab(): ReactElement {
	const [selectedGauge, set_selectedGauge] = useState('');
	const [selectedAction, set_selectedAction] = useState<'stake' | 'unstake' | undefined>();
	const {provider, address, isActive, chainID} = useWeb3();
	const {gaugeAddresses, gaugesMap, positionsMap, allowancesMap, refresh: refreshGauges, isLoading: isLoadingGauges} = useGauge();
	const {vaults} = useYearn();
	const {balances, refresh: refreshBalances} = useWallet();
	const refreshData = (): unknown => Promise.all([refreshGauges(), refreshBalances()]);
	const [approveAndStake, approveAndStakeStatus] = useTransaction(GaugeActions.approveAndStake, refreshData);
	const [stake, stakeStatus] = useTransaction(GaugeActions.stake, refreshData);
	const [unstake, unstakeStatus] = useTransaction(GaugeActions.unstake, refreshData);

	const web3Provider = provider as ethers.providers.Web3Provider;
	const userAddress = address as TAddress;

	const gaugesData = gaugeAddresses.map((address): TGaugeData => {
		const gauge = gaugesMap[address];
		const vaultAddress = toAddress(gauge?.vaultAddress);
		const vault = vaults[vaultAddress];

		return {
			gaugeAddress: address,
			vaultAddress,
			decimals: gauge?.decimals ?? 18,
			vaultIcon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vaultAddress}/logo-128.png`,
			vaultName: vault?.display_name ?? '',
			vaultApy: vault?.apy.net_apy ?? 0,
			vaultDeposited: formatBN(balances[vaultAddress]?.raw),
			gaugeApy: 0, // TODO: gauge apy calcs
			gaugeBoost: positionsMap[address]?.boost ?? 1,
			gaugeStaked: formatBN(positionsMap[address]?.deposit.balance),
			allowance: formatBN(allowancesMap[allowanceKey(1, vaultAddress, address, userAddress)]),
			isApproved: formatBN(allowancesMap[allowanceKey(1, vaultAddress, address, userAddress)]).gte(formatBN(balances[vaultAddress]?.raw)),
			actions: undefined
		};
	});

	const {isValid: isValidNetwork} = validateNetwork({supportedNetwork: 1, walletNetwork: chainID});

	const onApproveAndStake = (vaultAddress: TAddress, gaugeAddress: TAddress, amount: BigNumber, allowance: BigNumber): void => {
		set_selectedGauge(gaugeAddress);
		set_selectedAction('stake');
		approveAndStake(web3Provider, userAddress, vaultAddress, gaugeAddress, amount, allowance);
	};

	const onStake = (gaugeAddress: TAddress, amount: BigNumber): void => {
		set_selectedGauge(gaugeAddress);
		set_selectedAction('stake');
		stake(web3Provider, userAddress, gaugeAddress, amount);
	};

	const onUnstake = (gaugeAddress: TAddress, amount: BigNumber): void => {
		set_selectedGauge(gaugeAddress);
		set_selectedAction('unstake');
		unstake(web3Provider, userAddress, gaugeAddress, amount);
	};

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
						transform: ({isApproved, vaultAddress, gaugeAddress, vaultDeposited, gaugeStaked, allowance}): ReactElement => (
							<div className={'flex flex-row justify-center space-x-2 md:justify-end'}>
								<Button 
									className={'w-full md:w-24'}
									onClick={(): void => onUnstake(gaugeAddress, gaugeStaked)}
									disabled={!isActive || !isValidNetwork || gaugeStaked.eq(0)}
									isBusy={gaugeAddress === selectedGauge && selectedAction === 'unstake' && unstakeStatus.loading}
								>
									{'Unstake'}
								</Button>
								{!isApproved && (
									<Button
										className={'w-full md:w-24'}
										onClick={(): void => onApproveAndStake(vaultAddress, gaugeAddress, vaultDeposited, allowance)}
										disabled={!isActive || !isValidNetwork || vaultDeposited.eq(0)}
										isBusy={(isLoadingGauges && vaultDeposited.gt(0)) || (gaugeAddress === selectedGauge && selectedAction === 'stake' && approveAndStakeStatus.loading)}
									>
										{'Stake'}
									</Button>
								)}
								{isApproved && (
									<Button
										className={'w-full md:w-24'}
										onClick={(): void => onStake(gaugeAddress, vaultDeposited)}
										disabled={!isActive || !isValidNetwork || vaultDeposited.eq(0)}
										isBusy={(isLoadingGauges && vaultDeposited.gt(0)) || (gaugeAddress === selectedGauge && selectedAction === 'stake' && stakeStatus.loading)}
									>
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

export {GaugesTab};
