import React, {useMemo, useState} from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import {getMessariSubgraphEndpoint} from '@vaults/utils';
import {Button} from '@yearn-finance/web-lib/components/Button';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {graphFetcher} from '@common/utils';

import type {LoaderComponent} from 'next/dynamic';
import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas';
import type {TGraphData, TMessariGraphData} from '@common/types/types';
import type {TGraphForVaultEarningsProps} from '@vaults/components/graphs/GraphForVaultEarnings';
import type {TGraphForVaultPPSGrowthProps} from '@vaults/components/graphs/GraphForVaultPPSGrowth';
import type {TGraphForVaultTVLProps} from '@vaults/components/graphs/GraphForVaultTVL';

const GraphForVaultTVL = dynamic<TGraphForVaultTVLProps>(async (): LoaderComponent<TGraphForVaultTVLProps> => import('@vaults/components/graphs/GraphForVaultTVL'), {ssr: false});
const GraphForVaultPPSGrowth = dynamic<TGraphForVaultPPSGrowthProps>(async (): LoaderComponent<TGraphForVaultPPSGrowthProps> => import('@vaults/components/graphs/GraphForVaultPPSGrowth'), {ssr: false});
const GraphForVaultEarnings = dynamic<TGraphForVaultEarningsProps>(async (): LoaderComponent<TGraphForVaultEarningsProps> => import('@vaults/components/graphs/GraphForVaultEarnings'), {ssr: false});

function	VaultDetailsHistorical({currentVault, harvestData}: {currentVault: TYDaemonVault, harvestData: TGraphData[]}): ReactElement {
	const {safeChainID} = useChainID();
	const [selectedViewIndex, set_selectedViewIndex] = useState(0);

	const	{data: messariMixedData} = useSWR(currentVault.address ? [
		getMessariSubgraphEndpoint(safeChainID),
		`{
			vaultDailySnapshots(
				where: {vault: "${currentVault.address.toLowerCase()}"}
				orderBy: timestamp
				orderDirection: asc
				first: 1000
			) {
				pricePerShare
				totalValueLockedUSD
				timestamp
			}
		}`
	] : null, graphFetcher);

	const	messariData = useMemo((): TMessariGraphData[] => {
		const	_messariMixedData = [...((messariMixedData?.vaultDailySnapshots as {timestamp: string, totalValueLockedUSD: string, pricePerShare: string}[]) || [])];
		return (
			_messariMixedData?.map((elem): TMessariGraphData => ({
				name: formatDate(Number(elem.timestamp) * 1000),
				tvl: Number(elem.totalValueLockedUSD),
				pps: formatToNormalizedValue(formatBN(elem.pricePerShare), currentVault.decimals)
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
						className={'yearn--button-smaller !border-x-0'}>
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
						className={'yearn--button-smaller !border-x-0'}>
						{'Earnings'}
					</Button>
				</div>
			</div>
			<div className={'mt-4 flex flex-row space-x-8 border-b border-l border-neutral-300'} style={{height: 312}}>
				<Renderable shouldRender={selectedViewIndex === 0}>
					<GraphForVaultTVL messariData={messariData} />
				</Renderable>

				<Renderable shouldRender={selectedViewIndex === 1}>
					<GraphForVaultPPSGrowth messariData={messariData} />
				</Renderable>

				<Renderable shouldRender={selectedViewIndex === 2}>
					<GraphForVaultEarnings currentVault={currentVault} harvestData={harvestData} />
				</Renderable>
			</div>
		</div>
	);
}

export {VaultDetailsHistorical};
