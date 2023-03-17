import {useState} from 'react';
import {useGauge} from '@veYFI/contexts/useGauge';
import {useTransaction} from '@veYFI/hooks/useTransaction';
import * as GaugeActions from '@veYFI/utils/actions/gauge';
import {validateNetwork} from '@veYFI/utils/validations';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {Table} from '@common/components/Table';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';

import type {BigNumber, ethers} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function GaugesTab(): ReactElement {
	const [selectedGauge, set_selectedGauge] = useState('');
	const [selectedAction, set_selectedAction] = useState<'stake' | 'unstake' | undefined>();
	const {provider, address, isActive, chainID} = useWeb3();
	const {gaugeAddresses, gaugesMap, positionsMap, allowancesMap, refresh: refreshGauges} = useGauge();
	const {vaults} = useYearn();
	const {balances, refresh: refreshBalances} = useWallet();
	const refreshData = (): unknown => Promise.all([refreshGauges(), refreshBalances()]);
	const [approveAndStake, approveAndStakeStatus] = useTransaction(GaugeActions.approveAndStake, refreshData);
	const [stake, stakeStatus] = useTransaction(GaugeActions.stake, refreshData);
	const [unstake, unstakeStatus] = useTransaction(GaugeActions.unstake, refreshData);

	const web3Provider = provider as ethers.providers.Web3Provider;
	const userAddress = address as TAddress;

	const gaugesData = gaugeAddresses.map((address): any => {
		const gauge = gaugesMap[address];
		const vaultAddress = toAddress(gauge?.vaultAddress);
		const vault = vaults[vaultAddress];

		return {
			gaugeAddress: address,
			vaultAddress,
			vaultIcon: `${process.env.BASE_YEARN_ASSETS_URI}/1/${vaultAddress}/logo-128.png`,
			vaultName: vault?.display_name ?? '',
			vaultApy: vault?.apy.net_apy ?? 0,
			vaultDeposited: balances[vaultAddress].raw,
			gaugeApy: 0, // TODO: gauge apy calcs
			gaugeBoost: positionsMap[address]?.boost ?? 0,
			gaugeStaked: formatBN(positionsMap[address]?.deposit.balance),
			allowance: allowancesMap[address],
			isApproved: formatBN(allowancesMap[address]).gte(balances[vaultAddress].raw)
		};
	});
	console.log(gaugesData);

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
						sortable: true
					},
					{
						key: 'vaultDeposited',
						label: 'Deposited in Vault',
						sortable: true
					},
					{
						key: 'gaugeApy',
						label: 'Gauge APY',
						sortable: true
					},
					{
						key: 'gaugeboost',
						label: 'Boost',
						sortable: true
					},
					{
						key: 'gaugeStaked',
						label: 'Staked in Gauge',
						sortable: true
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
									className={'w-full md:w-fit'}
									onClick={(): void => onUnstake(gaugeAddress, gaugeStaked)}
									disabled={!isActive || !isValidNetwork || gaugeStaked.eq(0)}
									isBusy={gaugeAddress === selectedGauge && selectedAction === 'unstake' && unstakeStatus.loading}
								>
									{'Unstake'}
								</Button>
								{!isApproved && (
									<Button
										className={'w-full md:w-fit'}
										onClick={(): void => onApproveAndStake(vaultAddress, gaugeAddress, vaultDeposited, allowance)}
										disabled={!isActive || !isValidNetwork || vaultDeposited.eq(0)}
										isBusy={gaugeAddress === selectedGauge && selectedAction === 'stake' && approveAndStakeStatus.loading}
									>
										{'Stake'}
									</Button>
								)}
								{isApproved && (
									<Button
										className={'w-full md:w-fit'}
										onClick={(): void => onStake(gaugeAddress, vaultDeposited)}
										disabled={!isActive || !isValidNetwork || vaultDeposited.eq(0)}
										isBusy={gaugeAddress === selectedGauge && selectedAction === 'stake' && stakeStatus.loading}
									>
										{'Stake'}
									</Button>
								)}
							</div>
						)
					}
				]}
				// data={gaugesData}
				data={[
					{
						gaugeAddress: toAddress('0xA696a63cc78DfFa1a63E9E50587C197387FF6C7E'),
						vaultAddress: toAddress('0xA696a63cc78DfFa1a63E9E50587C197387FF6C7E'),
						vaultIcon: `${process.env.BASE_YEARN_ASSETS_URI}/1/0xA696a63cc78DfFa1a63E9E50587C197387FF6C7E/logo-128.png`,
						vaultName: 'yvWBTC',
						vaultApy: '42%',
						vaultDeposited: formatBN('0'),
						gaugeApy: '42%',
						gaugeboost: 'x1',
						gaugeStaked: formatBN('0'),
						allowance: formatBN('0'),
						isApproved: false,
						actions: null
					},
					{
						gaugeAddress: toAddress('0xdA816459F1AB5631232FE5e97a05BBBb94970c95'),
						vaultAddress: toAddress('0xdA816459F1AB5631232FE5e97a05BBBb94970c95'),
						vaultIcon: `${process.env.BASE_YEARN_ASSETS_URI}/1/0xdA816459F1AB5631232FE5e97a05BBBb94970c95/logo-128.png`,
						vaultName: 'yvDAI',
						vaultApy: '42%',
						vaultDeposited: formatBN('0'),
						gaugeApy: '42%',
						gaugeboost: 'x10',
						gaugeStaked: formatBN('0'),
						allowance: formatBN('0'),
						isApproved: true,
						actions: null
					}
				]}
				columns={9}
				initialSortBy={'gaugeApy'}
			/>
		</div>
	);
}

export {GaugesTab};
