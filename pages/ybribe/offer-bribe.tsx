import React, {useCallback, useMemo, useState} from 'react';
import Link from 'next/link';
import {BigNumber} from 'ethers';
import {Button} from '@yearn-finance/web-lib/components';
import {performBatchedUpdates} from '@yearn-finance/web-lib/utils';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';
import {GaugeTableEmpty} from '@yBribe/components/bribe/GaugeTableEmpty';
import {GaugeTableHead} from '@yBribe/components/bribe/GaugeTableHead';
import {GaugeTableRow} from '@yBribe/components/bribe/GaugeTableRow';
import {useBribes} from '@yBribe/contexts/useBribes';
import Wrapper from '@yBribe/Wrapper';

import type {ChangeEvent, ReactElement, ReactNode} from 'react';
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

	const	filteredGauges = useMemo((): TCurveGauges[] => {
		if (category === 'factory') {
			return gauges.filter((gauge): boolean => gauge.factory);
		}
		return gauges.filter((gauge): boolean => !gauge.factory);
	}, [category, gauges]);

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
		if (sortBy === 'rewards') {
			return searchedGauges.sort((a, b): number => {
				const allARewardsV3 = Object.entries(currentRewards?.v3?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);
				const allARewardsV2 = Object.entries(currentRewards?.v2?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, (value || BigNumber.from(0)).div(126144000));
					return acc + aBribeValue;
				}, 0);
				const	allARewards = allARewardsV3 + allARewardsV2;

				const allBRewardsV3 = Object.entries(currentRewards?.v3?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);
				const allBRewardsV2 = Object.entries(currentRewards?.v2?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, (value || BigNumber.from(0)).div(126144000));
					return acc + aBribeValue;
				}, 0);
				const	allBRewards = allBRewardsV3 + allBRewardsV2;

				if (sortDirection === 'desc') {
					return allBRewards - allARewards;
				}
				return allARewards - allBRewards;
			});
		}
		if (sortBy === 'pendingRewards') {
			return searchedGauges.sort((a, b): number => {
				const allARewardsV3 = Object.entries(nextRewards?.v3?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);
				const allARewardsV2 = Object.entries(nextRewards?.v2?.[toAddress(a.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, (value || BigNumber.from(0)).div(126144000));
					return acc + aBribeValue;
				}, 0);
				const	allARewards = allARewardsV3 + allARewardsV2;

				const allBRewardsV3 = Object.entries(nextRewards?.v3?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, value || BigNumber.from(0));
					return acc + aBribeValue;
				}, 0);
				const allBRewardsV2 = Object.entries(nextRewards?.v2?.[toAddress(b.gauge)] || {}).reduce((acc, [address, value]): number => {
					const aBribeValue = getRewardValue(address, (value || BigNumber.from(0)).div(126144000));
					return acc + aBribeValue;
				}, 0);
				const	allBRewards = allBRewardsV3 + allBRewardsV2;

				if (sortDirection === 'desc') {
					return allBRewards - allARewards;
				}
				return allARewards - allBRewards;
			});
		}
		return searchedGauges;
	}, [sortBy, searchedGauges, sortDirection, currentRewards, nextRewards, getRewardValue]);
	

	return (
		<section className={'mt-4 mb-20 grid w-full grid-cols-12 pb-10 md:mb-40 md:mt-20'}>
			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<div className={'flex flex-row items-center justify-between space-x-6 px-4 pt-4 pb-2 md:space-x-0 md:px-10 md:pt-10 md:pb-8'}>
					<div className={'w-1/2 md:w-auto'}>
						<h2 className={'text-lg font-bold md:text-3xl'}>
							{'Offer Bribe'}
						</h2>
					</div>
					<div className={'hidden flex-row space-x-4 md:flex'}>
						<Button
							onClick={(): void => set_category('all')}
							variant={category === 'all' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'All'}
						</Button>
						<Button
							onClick={(): void => set_category('factory')}
							variant={category === 'factory' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'Factory'}
						</Button>
						<div className={'flex h-8 items-center border border-neutral-0 bg-neutral-0 p-2'}>
							<div className={'flex h-8 w-full flex-row items-center justify-between py-2 px-0'}>
								<input
									className={'w-full overflow-x-scroll border-none bg-transparent py-2 px-0 text-xs outline-none scrollbar-none'}
									type={'text'}
									placeholder={'Search'}
									value={searchValue}
									onChange={(e: ChangeEvent<HTMLInputElement>): void => {
										set_searchValue(e.target.value);
									}} />
							</div>
						</div>
					</div>
					<div className={'flex w-2/3 flex-row space-x-2 md:hidden'}>
						<select
							className={'yearn--button-smaller !w-[120%] border-none bg-neutral-900 text-neutral-0'}
							onChange={(e): void => set_category(e.target.value)}>
							<option value={'all'}>{'All'}</option>
							<option value={'factory'}>{'Factory'}</option>
						</select>
						<div className={'flex h-8 items-center border border-neutral-0 bg-neutral-0 p-2'}>
							<div className={'flex h-8 w-full flex-row items-center justify-between py-2 px-0'}>
								<input
									className={'w-full overflow-x-scroll border-none bg-transparent py-2 px-0 text-xs outline-none scrollbar-none'}
									type={'text'}
									placeholder={'Search'}
									value={searchValue}
									onChange={(e: ChangeEvent<HTMLInputElement>): void => {
										set_searchValue(e.target.value);
									}} />
							</div>
						</div>
					</div>
				</div>
				<div className={'grid w-full grid-cols-1 pb-2 md:pb-4'}>
					<GaugeTableHead
						sortBy={sortBy}
						sortDirection={sortDirection}
						onSort={(_sortBy: string, _sortDirection: string): void => {
							performBatchedUpdates((): void => {
								set_sortBy(_sortBy);
								set_sortDirection(_sortDirection);
							});
						}} />
					{sortedGauges.length === 0 ? (
						<GaugeTableEmpty />
					) : sortedGauges.map((gauge): ReactNode => {
						if (!gauge) {
							return (null);
						}
						return <GaugeTableRow key={gauge.name} currentGauge={gauge} />;
					})}
				</div>
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


OfferBribe.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default OfferBribe;
