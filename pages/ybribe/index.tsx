import React, {useCallback, useMemo, useState} from 'react';
import Balancer from 'react-wrap-balancer';
import Link from 'next/link';
import {BigNumber} from 'ethers';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import {useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';
import {stringSort} from '@common/utils/sort';
import {GaugeListEmpty} from '@yBribe/components/claim/GaugeListEmpty';
import {GaugeListRow} from '@yBribe/components/claim/GaugeListRow';
import {useBribes} from '@yBribe/contexts/useBribes';
import Wrapper from '@yBribe/Wrapper';

import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';
import type {TCurveGauges} from '@common/types/curves';
import type {TSortDirection} from '@common/types/types';

function	GaugeList(): ReactElement {
	const	{tokens, prices} = useYearn();
	const	{currentRewards, nextRewards, claimable} = useBribes();
	const	{gauges} = useCurve();
	const	[category, set_category] = useState('all');
	const	[searchValue, set_searchValue] = useState('');
	const 	[sort, set_sort] = useSessionStorage<{sortBy: string, sortDirection: TSortDirection}>(
		'yGaugeListBribeSorting', {sortBy: '', sortDirection: 'desc'}
	);

	const	getRewardValue = useCallback((address: string, value: BigNumber): number => {
		const	tokenInfo = tokens?.[address];
		const	tokenPrice = prices?.[address];
		const	decimals = tokenInfo?.decimals || 18;
		const	bribeAmount = formatToNormalizedValue(formatBN(value), decimals);
		const	bribeValue = bribeAmount * (Number(tokenPrice || 0) / 100);
		return bribeValue;
	}, [prices, tokens]);

	const	filteredGauges = useMemo((): TCurveGauges[] => {
		if (category === 'claimable') {
			return gauges.filter((gauge): boolean => {
				const currentClaimableMapV3 = Object.values(claimable?.v3?.[toAddress(gauge.gauge)] || {});
				return currentClaimableMapV3.some((value: BigNumber): boolean => value.gt(0));
			});
		}
		return gauges.filter((gauge): boolean => {
			const hasCurrentRewardsV3 = currentRewards?.v3?.[toAddress(gauge.gauge)] !== undefined;
			const hasNextRewardsV3 = nextRewards?.v3?.[toAddress(gauge.gauge)] !== undefined;
			return hasCurrentRewardsV3 || hasNextRewardsV3;
		});
	}, [category, gauges, currentRewards, nextRewards, claimable]);

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
		if (sort.sortBy === 'name') {
			return searchedGauges.sort((a, b): number => stringSort({a: a.name, b: b.name, sortDirection: sort.sortDirection}));
		}
		if (sort.sortBy === 'rewards') {
			return searchedGauges.sort((a, b): number => {
				const allARewards = Object.entries(currentRewards?.v3?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);

				const allBRewards = Object.entries(currentRewards?.v3?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);

				if (sort.sortDirection === 'desc') {
					return allBRewards - allARewards;
				}
				return allARewards - allBRewards;
			});
		}
		if (sort.sortBy === 'pendingRewards') {
			return searchedGauges.sort((a, b): number => {
				const allARewards = Object.entries(nextRewards?.v3?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);

				const allBRewards = Object.entries(nextRewards?.v3?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);

				if (sort.sortDirection === 'desc') {
					return allBRewards - allARewards;
				}
				return allARewards - allBRewards;
			});
		}

		return searchedGauges;
	}, [sort.sortBy, sort.sortDirection, searchedGauges, currentRewards?.v3, getRewardValue, nextRewards?.v3]);
	
	const	onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		set_sort({sortBy: newSortBy, sortDirection: newSortDirection as TSortDirection});
	}, [set_sort]);

	return (
		<section className={'mt-4 mb-20 grid w-full grid-cols-12 pb-10 md:mb-40 md:mt-20'}>
			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<ListHero
					headLabel={'Claim Bribe'}
					searchLabel={`Search ${category}`}
					searchPlaceholder={'f-yfieth'}
					categories={[
						[
							{value: 'claimable', label: 'Claimable', isSelected: category === 'claimable'},
							{value: 'all', label: 'All', isSelected: category === 'all'}
						]
					]}
					onSelect={set_category}
					searchValue={searchValue}
					set_searchValue={set_searchValue} />
				<ListHead
					sortBy={sort.sortBy}
					sortDirection={sort.sortDirection}
					onSort={onSort}
					dataClassName={'grid-cols-5'}
					items={[
						{label: 'Gauges', value: 'name', sortable: true},
						{label: '', value: '', sortable: false},
						{label: '$/veCRV', value: 'rewards', sortable: false},
						{label: 'APR', value: 'apr', sortable: false},
						{label: 'Claimable', value: 'claimable', sortable: false},
						{label: '', value: '', sortable: false}
					]} />
					
				{sortedGauges.length === 0 ? (
					<GaugeListEmpty category={category} />
				) : sortedGauges.map((gauge): ReactNode => {
					if (!gauge) {
						return (null);
					}
					return <GaugeListRow
						key={gauge.name}
						currentGauge={gauge}
						category={category} />;
				})}
			</div>
		</section>
	);
}

function	Index(): ReactElement {
	return (
		<>
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<Balancer>
					<b className={'text-center text-lg md:text-2xl'}>{'Get more for your votes.'}</b>
					<p className={'mt-8 whitespace-pre-line text-center text-base text-neutral-600'}>
						{'Sell your vote to the highest bidder by voting on the briber\'s gauge and claiming a reward.\nIt\'s like DC lobbying, but without the long lunches.'}
					</p>
				</Balancer>
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
				<Link href={'/ybribe/offer-bribe'} className={'w-full md:w-auto'}>
					<Button className={'w-full'}>
						{'Offer Bribe'}
					</Button>
				</Link>
			</div>
			<GaugeList />
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
