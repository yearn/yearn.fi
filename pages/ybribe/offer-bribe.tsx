import {useCallback, useMemo, useState} from 'react';
import {Balancer} from 'react-wrap-balancer';
import Link from 'next/link';
import {Button} from '@yearn-finance/web-lib/components/Button';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isTAddress} from '@yearn-finance/web-lib/utils/isTAddress';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import {useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';
import {stringSort} from '@common/utils/sort';
import {GaugeListEmpty} from '@yBribe/components/bribe/GaugeListEmpty';
import {GaugeListRow} from '@yBribe/components/bribe/GaugeListRow';
import {useBribes} from '@yBribe/contexts/useBribes';
import Wrapper from '@yBribe/Wrapper';

import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';
import type {TCurveGauge} from '@common/schemas/curveSchemas';
import type {TSortDirection} from '@common/types/types';

function GaugeList(): ReactElement {
	const {tokens, prices} = useYearn();
	const {gauges} = useCurve();
	const {currentRewards, nextRewards} = useBribes();
	const [category, set_category] = useState('all');
	const [searchValue, set_searchValue] = useState('');
	const [sort, set_sort] = useSessionStorage<{sortBy: string, sortDirection: TSortDirection}>(
		'yGaugeListOfferBribeSorting', {sortBy: '', sortDirection: 'desc'}
	);

	const getRewardValue = useCallback((address: string, value: bigint): number => {
		if (!isTAddress(address)) {
			return 0;
		}
		const tokenInfo = tokens?.[address];
		const tokenPrice = prices?.[address];
		const decimals = tokenInfo?.decimals || 18;
		const bribeAmount = formatToNormalizedValue(toBigInt(value), decimals);
		const bribeValue = bribeAmount * (Number(tokenPrice || 0) / 100);
		return bribeValue;
	}, [prices, tokens]);

	const standardGauges = useMemo((): TCurveGauge[] => gauges.filter((gauge): boolean => !gauge.factory), [gauges]);
	const factoryGauges = useMemo((): TCurveGauge[] => gauges.filter((gauge): boolean => gauge.factory), [gauges]);
	const filteredGauges = useMemo((): TCurveGauge[] => {
		if (category === 'standard') {
			return standardGauges;
		}
		if (category === 'factory') {
			return factoryGauges;
		}
		return gauges;
	}, [category, gauges, factoryGauges, standardGauges]);

	const searchedGauges = useMemo((): TCurveGauge[] => {
		const gaugesToSearch = [...filteredGauges];

		if (searchValue === '') {
			return gaugesToSearch;
		}
		return gaugesToSearch.filter((gauge): boolean => {
			const searchString = `${gauge.name} ${gauge.gauge}`;
			return searchString.toLowerCase().includes(searchValue.toLowerCase());
		});
	}, [filteredGauges, searchValue]);

	const sortedGauges = useMemo((): TCurveGauge[] => {
		if (sort.sortBy === 'name') {
			return searchedGauges.sort((a, b): number => stringSort({a: a.name, b: b.name, sortDirection: sort.sortDirection}));
		}
		if (sort.sortBy === 'rewards') {
			return searchedGauges.sort((a, b): number => {
				const allARewards = Object.entries(currentRewards?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || 0n);
					return acc + aBribeValue;
				}, 0);

				const allBRewards = Object.entries(currentRewards?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || 0n);
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
				const allARewards = Object.entries(nextRewards?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || 0n);
					return acc + aBribeValue;
				}, 0);

				const allBRewards = Object.entries(nextRewards?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || 0n);
					return acc + aBribeValue;
				}, 0);

				if (sort.sortDirection === 'desc') {
					return allBRewards - allARewards;
				}
				return allARewards - allBRewards;
			});
		}
		return searchedGauges;
	}, [sort.sortBy, sort.sortDirection, searchedGauges, currentRewards, getRewardValue, nextRewards]);

	const onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		set_sort({sortBy: newSortBy, sortDirection: newSortDirection as TSortDirection});
	}, [set_sort]);

	return (
		<section className={'mb-20 mt-4 grid w-full grid-cols-12 pb-10 md:mb-40 md:mt-20'}>
			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<ListHero
					headLabel={'Offer Bribe'}
					searchLabel={`Search ${category}`}
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
					sortBy={sort.sortBy}
					sortDirection={sort.sortDirection}
					onSort={onSort}
					dataClassName={'grid-cols-9'}
					items={[
						{label: 'Gauges', value: 'name', sortable: true},
						{label: 'Weight', value: 'weight', sortable: false, className: 'col-span-1'},
						{label: 'Current $/veCRV', value: 'rewards', sortable: true, className: 'col-span-3'},
						{label: 'Pending $/veCRV', value: 'pendingRewards', sortable: true, className: 'col-span-3'},
						{label: '', value: '', sortable: false, className: 'col-span-1'}
					]} />

				<Renderable
					shouldRender={sortedGauges.length > 0}
					fallback={<GaugeListEmpty />}>
					{sortedGauges.filter((gauge): boolean => !!gauge).map((gauge): ReactNode =>
						<GaugeListRow key={gauge.name} currentGauge={gauge} />
					)}
				</Renderable>
			</div>
		</section>
	);
}

function OfferBribe(): ReactElement {
	return (
		<>
			<div className={'mb-10 mt-8 w-full max-w-6xl text-center'}>
				<Balancer>
					<b className={'text-center text-lg md:text-2xl'}>{'Buy votes to boost emissions.'}</b>
					<p className={'mt-8 whitespace-pre-line text-center text-base text-neutral-600'}>
						{'Offer a bribe to increase CRV emissions to your favorite Curve pool.\nJust like democracy, minus the suit and expense account.'}
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
