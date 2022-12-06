import React, {Suspense, useMemo, useState} from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import {getMessariSubgraphEndpoint} from '@vaults/utils';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {graphFetcher} from '@common/utils';

import type {ReactElement} from 'react';
import type {TGraphData, TMessariGraphData} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

const GraphForVaultTVL = dynamic((): any => import('@vaults/components/graphs/GraphForVaultTVL'), {suspense: true, ssr: false}) as any;
const GraphForVaultPPSGrowth = dynamic((): any => import('@vaults/components/graphs/GraphForVaultPPSGrowth'), {suspense: true, ssr: false}) as any;
const GraphForVaultEarnings = dynamic((): any => import('@vaults/components/graphs/GraphForVaultEarnings'), {suspense: true, ssr: false}) as any;

function	VaultDetailsHistorical({currentVault, harvestData}: {currentVault: TYearnVault, harvestData: TGraphData[]}): ReactElement {
	const {safeChainID} = useChainID();
	const [selectedViewIndex, set_selectedViewIndex] = useState(0);
	
	const	{data: messariMixedData} = useSWR(currentVault.address ? [
		getMessariSubgraphEndpoint(safeChainID),
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
			<div className={'mt-4 flex flex-row space-x-8 border-b border-l border-neutral-300'}>
				{selectedViewIndex === 0 ?(
					<Suspense>
						<GraphForVaultTVL messariData={messariData} />
					</Suspense>
				) : null}
				{selectedViewIndex === 1 ? (
					<Suspense>
						<GraphForVaultPPSGrowth messariData={messariData} />
					</Suspense>
				) : null}
				{selectedViewIndex === 2 ? (
					<Suspense>
						<GraphForVaultEarnings currentVault={currentVault} harvestData={harvestData} />
					</Suspense>
				) : null}
			</div>
		</div>
	);
}

export {VaultDetailsHistorical};