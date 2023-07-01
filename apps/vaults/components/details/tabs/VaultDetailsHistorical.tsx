import {useMemo, useState} from 'react';
import useSWR from 'swr';
import {useIsMounted} from '@react-hookz/web';
import {GraphForVaultEarnings} from '@vaults/components/graphs/GraphForVaultEarnings';
import {GraphForVaultPPSGrowth} from '@vaults/components/graphs/GraphForVaultPPSGrowth';
import GraphForVaultTVL from '@vaults/components/graphs/GraphForVaultTVL';
import {getMessariSubgraphEndpoint} from '@vaults/utils';
import {Button} from '@yearn-finance/web-lib/components/Button';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {graphFetcher} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TGraphData, TMessariGraphData} from '@common/types/types';

function VaultDetailsHistorical({currentVault, harvestData}: {currentVault: TYDaemonVault, harvestData: TGraphData[]}): ReactElement {
	const isMounted = useIsMounted();
	const {safeChainID} = useChainID();
	const [selectedViewIndex, set_selectedViewIndex] = useState(0);

	const {data: messariMixedData} = useSWR(currentVault.address ? [
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

	const messariData = useMemo((): TMessariGraphData[] => {
		const _messariMixedData = [...((messariMixedData?.vaultDailySnapshots as {timestamp: string, totalValueLockedUSD: string, pricePerShare: string}[]) || [])];
		return (
			_messariMixedData?.map((elem): TMessariGraphData => ({
				name: formatDate(Number(elem.timestamp) * 1000),
				tvl: Number(elem.totalValueLockedUSD),
				pps: formatToNormalizedValue(toBigInt(elem.pricePerShare), currentVault.decimals)
			}))
		);
	}, [currentVault.decimals, messariMixedData?.vaultDailySnapshots]);

	return (
		<div className={'bg-neutral-100 p-4 md:p-8'}>
			<div className={'w-max'}>
				<div className={'mt-1 flex flex-row space-x-0 divide-x border-x border-neutral-900'}>
					<Button
						onClick={(): void => set_selectedViewIndex(0)}
						variant={isZero(selectedViewIndex) ? 'filled' : 'outlined'}
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
				<Renderable shouldRender={isMounted() && isZero(selectedViewIndex)}>
					<GraphForVaultTVL messariData={messariData} />
				</Renderable>

				<Renderable shouldRender={isMounted() && selectedViewIndex === 1}>
					<GraphForVaultPPSGrowth messariData={messariData} />
				</Renderable>

				<Renderable shouldRender={isMounted() && selectedViewIndex === 2}>
					<GraphForVaultEarnings currentVault={currentVault} harvestData={harvestData} />
				</Renderable>
			</div>
		</div>
	);
}

export {VaultDetailsHistorical};
