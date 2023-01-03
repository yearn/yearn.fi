import React, {useCallback, useMemo, useState} from 'react';
import Link from 'next/link';
import {BigNumber} from 'ethers';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import {useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';
import {GaugeListEmpty} from '@yBribe/components/bribe/GaugeListEmpty';
import {GaugeListRow} from '@yBribe/components/bribe/GaugeListRow';
import {useBribes} from '@yBribe/contexts/useBribes';
import Wrapper from '@yBribe/Wrapper';

import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';
import type {TCurveGauges} from '@common/types/curves';

function	GaugeList(): ReactElement {
	const	{tokens, prices} = useYearn();
	const	{gauges} = useCurve();
	const	{currentRewards, nextRewards} = useBribes();
	const	[category, set_category] = useState('all');
	const	[searchValue, set_searchValue] = useState('');
	const	[sortBy, set_sortBy] = useState('');
	const	[sortDirection, set_sortDirection] = useState('desc');

	const	getRewardValue = useCallback((address: string, value: BigNumber): number => {
		const	tokenInfo = tokens?.[address];
		const	tokenPrice = prices?.[address];
		const	decimals = tokenInfo?.decimals || 18;
		const	bribeAmount = formatToNormalizedValue(formatBN(value), decimals);
		const	bribeValue = bribeAmount * (Number(tokenPrice || 0) / 100);
		return bribeValue;
	}, [prices, tokens]);

	const	standardGauges = useMemo((): TCurveGauges[] => gauges.filter((gauge): boolean => !gauge.factory), [gauges]);
	const	factoryGauges = useMemo((): TCurveGauges[] => gauges.filter((gauge): boolean => gauge.factory), [gauges]);
	const	filteredGauges = useMemo((): TCurveGauges[] => {
		if (category === 'standard') {
			return standardGauges;
		} if (category === 'factory') {
			return factoryGauges;
		}
		return gauges;
	}, [category, gauges, factoryGauges, standardGauges]);

	const	searchedGauges = useMemo((): TCurveGauges[] => {
		const	gaugesToSearch = [...filteredGauges];
	
		if (searchValue === '') {
			return gaugesToSearch;
		}
		return gaugesToSearch.filter((gauge): boolean => {
			const	searchString = `${gauge.name} ${gauge.gauge}`;
			return searchString.toLowerCase().includes(searchValue.toLowerCase());
		});
	}, [filteredGauges, searchValue]);
	
	const	sortedGauges = useMemo((): TCurveGauges[] => {
		if (sortBy === 'name') {
			return searchedGauges.sort((a, b): number => {
				if (sortDirection === 'desc') {
					return a.name.localeCompare(b.name);
				}
				return b.name.localeCompare(a.name);
			});
		} if (sortBy === 'rewards') {
			return searchedGauges.sort((a, b): number => {
				const allARewards = Object.entries(currentRewards?.v3?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);

				const allBRewards = Object.entries(currentRewards?.v3?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);

				if (sortDirection === 'desc') {
					return allBRewards - allARewards;
				}
				return allARewards - allBRewards;
			});
		} if (sortBy === 'pendingRewards') {
			return searchedGauges.sort((a, b): number => {
				const allARewards = Object.entries(nextRewards?.v3?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);

				const allBRewards = Object.entries(nextRewards?.v3?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);

				if (sortDirection === 'desc') {
					return allBRewards - allARewards;
				}
				return allARewards - allBRewards;
			});
		}
		return searchedGauges;
	}, [sortBy, searchedGauges, sortDirection, currentRewards, nextRewards, getRewardValue]);

	const	onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		performBatchedUpdates((): void => {
			set_sortBy(newSortBy);
			set_sortDirection(newSortDirection);
		});
	}, []);

	return (
		<section className={'mt-4 mb-20 grid w-full grid-cols-12 pb-10 md:mb-40 md:mt-20'}>
			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<ListHero
					headLabel={'Offer Bribe'}
					searchPlaceholder={'f-yfieth'}
					categories={[
						[
							{value: 'standard', label: 'Standard', isSelected: category === 'standard'},
							{value: 'factory', label: 'Factory', isSelected: category === 'factory'},
							{value: 'all', label: 'All', isSelected: category === 'all'}
						]
					]}
					onSelect={set_category}
					searchValue={searchValue}
					set_searchValue={set_searchValue} />
				<ListHead
					sortBy={sortBy}
					sortDirection={sortDirection}
					onSort={onSort}
					dataClassName={'grid-cols-9'}
					items={[
						{label: 'Gauges', value: 'name', sortable: true},
						{label: 'Weight', value: 'weight', sortable: false, className: 'col-span-1'},
						{label: 'Current $/veCRV', value: 'rewards', sortable: true, className: 'col-span-3'},
						{label: 'Pending $/veCRV', value: 'pendingRewards', sortable: true, className: 'col-span-3'},
						{label: '', value: '', sortable: false, className: 'col-span-1'}
					]} />
					
				{sortedGauges.length === 0 ? (
					<GaugeListEmpty />
				) : sortedGauges.map((gauge): ReactNode => {
					if (!gauge) {
						return (null);
					}
					return <GaugeListRow key={gauge.name} currentGauge={gauge} />;
				})}
			</div>
		</section>
	);
}

function	OfferBribe(): ReactElement {
	return (
		<>
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<b className={'text-center text-lg md:text-2xl'}>{'Buy votes to boost emissions.'}</b>
				<p className={'mt-8 whitespace-pre-line text-center text-base text-neutral-600'}>
					{'Offer a bribe to increase CRV emissions to your favorite Curve pool.\nJust like democracy, minus the suit and expense account.'}
				</p>
			</div>
			<div className={'mb-10 flex flex-row items-center justify-center space-x-4 md:mb-0 md:space-x-10'}>
				<Link
					href={'https://dao.curve.fi/gaugeweight'}
					target={'_blank'}
					className={'w-full md:w-auto'}>
					<Button className={'w-full'}>
						{'Vote for Gauge'}
					</Button>
				</Link>
				<Link href={'/ybribe'} className={'w-full md:w-auto'}>
					<Button className={'w-full'}>
						{'Claim Bribe'}
					</Button>
				</Link>
			</div>
			<GaugeList />
		</>
	);
}

OfferBribe.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default OfferBribe;
