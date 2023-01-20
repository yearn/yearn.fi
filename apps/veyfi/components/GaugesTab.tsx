import {Button} from '@yearn-finance/web-lib/components/Button';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {Table} from '@common/components/Table';

import type {ReactElement} from 'react';

function GaugesTab(): ReactElement {
	return (
		<div className={'relative -left-8 w-[calc(100%+64px)]'}>
			<Table 
				metadata={[
					{
						key: 'name',
						label: 'Asset',
						sortable: true,
						fullWidth: true,
						className: 'my-4 md:my-0',
						transform: ({name, address}): ReactElement => (
							<div className={'flex flex-row items-center space-x-4 md:space-x-6'}>
								<div className={'flex h-8 min-h-[32px] w-8 min-w-[32px] items-center justify-center rounded-full md:h-10 md:w-10'}>
									<ImageWithFallback
										alt={name}
										width={40}
										height={40}
										quality={90}
										src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(address)}/logo-128.png`}
										loading={'eager'} 
									/>
								</div>
								<p>{name}</p>
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
						key: 'boost',
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
						label: 'Actions',
						columnSpan: 2,
						fullWidth: true,
						className: 'my-4 md:my-0',
						transform: (): ReactElement => (
							<div className={'flex flex-row justify-center space-x-2 md:justify-end'}>
								<Button className={'w-full md:w-fit'}>{'Unstake'}</Button>
								<Button className={'w-full md:w-fit'}>{'Stake'}</Button>
							</div>
						)
					}
				]}
				data={[
					{
						address: '0xA696a63cc78DfFa1a63E9E50587C197387FF6C7E',
						name: 'yvWBTC',
						vaultApy: '42%',
						vaultDeposited: '0',
						gaugeApy: '42%',
						boost: 'x1',
						gaugeStaked: '0',
						actions: null
					},
					{
						address: '0xdA816459F1AB5631232FE5e97a05BBBb94970c95',
						name: 'yvDAI',
						vaultApy: '42%',
						vaultDeposited: '0',
						gaugeApy: '42%',
						boost: 'x10',
						gaugeStaked: '0',
						actions: null
					}
				]}
				columns={8}
				initialSortBy={'gaugeApy'}
			/>
		</div>
	);
}

export {GaugesTab};
