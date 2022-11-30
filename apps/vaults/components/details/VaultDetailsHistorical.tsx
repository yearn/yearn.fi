import React, {useMemo, useState} from 'react';
import useSWR from 'swr';
import {GraphForVaultEarnings} from '@vaults/components/graphs/GraphForVaultEarnings';
import {GraphForVaultPPSGrowth} from '@vaults/components/graphs/GraphForVaultPPSGrowth';
import {GraphForVaultTVL} from '@vaults/components/graphs/GraphForVaultTVL';
import {Button} from '@yearn-finance/web-lib/components';
import {format} from '@yearn-finance/web-lib/utils';
import {graphFetcher} from '@common/utils';

import type {ReactElement} from 'react';
import type {TGraphData, TMessariGraphData} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

function	VaultDetailsHistorical({currentVault, harvestData}: {currentVault: TYearnVault, harvestData: TGraphData[]}): ReactElement {
	const	[selectedViewIndex, set_selectedViewIndex] = useState(0);
	
	const	{data: messariMixedData} = useSWR(currentVault.address ? [
		'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-ethereum',
		`{
			vaultDailySnapshots(
				where: {vault: "${currentVault.address.toLowerCase()}"}
				orderBy: timestamp
				orderDirection: asc
			) {
				pricePerShare
				totalValueLockedUSD
				timestamp
			}
		}`
	] : null, graphFetcher);

	const	messariData = useMemo((): TMessariGraphData[] => {
		const	_messariMixedData = [...(messariMixedData?.vaultDailySnapshots || [])];
		return (
			_messariMixedData?.map((elem): TMessariGraphData => ({
				name: format.date(Number(elem.timestamp) * 1000),
				tvl: Number(elem.totalValueLockedUSD),
				pps: format.toNormalizedValue(format.BN(elem.pricePerShare), currentVault.decimals)
			}))
		);
	}, [currentVault.decimals, messariMixedData?.vaultDailySnapshots]);

	return (
		<div className={'bg-neutral-100 p-4 md:p-8'}>
			<div className={'w-max'}>
				<div className={'mt-1 flex flex-row space-x-0 divide-x border-x border-neutral-900'}>
					<Button
						onClick={(): void => set_selectedViewIndex(0)}
						variant={selectedViewIndex === 0 ? 'filled' : 'outlined'}
						className={'yearn--button-smaller !border-l-0'}>
						{'TVL'}
					</Button>
					<Button
						onClick={(): void => set_selectedViewIndex(1)}
						variant={selectedViewIndex === 1 ? 'filled' : 'outlined'}
						className={'yearn--button-smaller !border-x-0'}>
						{'Growth'}
					</Button>
					<Button
						onClick={(): void => set_selectedViewIndex(2)}
						variant={selectedViewIndex === 2 ? 'filled' : 'outlined'}
						className={'yearn--button-smaller !border-r-0'}>
						{'Earnings'}
					</Button>
				</div>
			</div>
			<div className={'mt-4 flex flex-row space-x-8 border-b border-l border-neutral-300'}>
				{selectedViewIndex === 0 ? <GraphForVaultTVL messariData={messariData} /> : null}
				{selectedViewIndex === 1 ? <GraphForVaultPPSGrowth messariData={messariData} /> : null}
				{selectedViewIndex === 2 ? <GraphForVaultEarnings currentVault={currentVault} harvestData={harvestData} /> : null}
			</div>
		</div>
	);
}

export {VaultDetailsHistorical};