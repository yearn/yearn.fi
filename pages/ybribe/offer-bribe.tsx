import React, {useCallback, useMemo, useState} from 'react';
import Link from 'next/link';
import {BigNumber} from 'ethers';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';
import {GaugeListEmpty} from '@yBribe/components/bribe/GaugeListEmpty';
import {GaugeListHead} from '@yBribe/components/bribe/GaugeListHead';
import {GaugeListRow} from '@yBribe/components/bribe/GaugeListRow';
import {useBribes} from '@yBribe/contexts/useBribes';
import Wrapper from '@yBribe/Wrapper';

import type {ChangeEvent, ReactElement, ReactNode} from 'react';
import type {TCurveGauges} from '@common/types/curves';


function	TableHeader({category, set_category, searchValue, set_searchValue}: {
	category: string;
	set_category: (category: string) => void;
	searchValue: string;
	set_searchValue: (searchValue: string) => void;
}): ReactElement {
	return (
		<div className={'flex flex-col items-start justify-between space-x-0 px-4 pt-4 pb-2 md:px-10 md:pt-10 md:pb-8'}>
			<div className={'mb-6'}>
				<h2 className={'text-lg font-bold md:text-3xl'}>{'Offer Bribe'}</h2>
			</div>

			<div className={'hidden w-full flex-row items-center justify-between space-x-4 md:flex'}>
				<div className={'w-full'}>
					<label className={'text-neutral-600'}>{'Search'}</label>
					<div className={'mt-1 flex h-10 w-full items-center border border-neutral-0 bg-neutral-0 p-2 md:w-2/3'}>
						<div className={'relative flex h-10 w-full flex-row items-center justify-between'}>
							<input
								className={'h-10 w-full overflow-x-scroll border-none bg-transparent py-2 px-0 text-base outline-none scrollbar-none placeholder:text-neutral-400'}
								type={'text'}
								placeholder={'f-yfieth'}
								value={searchValue}
								onChange={(e: ChangeEvent<HTMLInputElement>): void => {
									set_searchValue(e.target.value);
								}} />
							<div className={'absolute right-0 text-neutral-400'}>
								<svg
									width={'20'}
									height={'20'}
									viewBox={'0 0 24 24'}
									fill={'none'}
									xmlns={'http://www.w3.org/2000/svg'}>
									<path
										fillRule={'evenodd'}
										clipRule={'evenodd'}
										d={'M10 1C5.02972 1 1 5.02972 1 10C1 14.9703 5.02972 19 10 19C12.1249 19 14.0779 18.2635 15.6176 17.0318L21.2929 22.7071C21.6834 23.0976 22.3166 23.0976 22.7071 22.7071C23.0976 22.3166 23.0976 21.6834 22.7071 21.2929L17.0318 15.6176C18.2635 14.0779 19 12.1249 19 10C19 5.02972 14.9703 1 10 1ZM3 10C3 6.13428 6.13428 3 10 3C13.8657 3 17 6.13428 17 10C17 13.8657 13.8657 17 10 17C6.13428 17 3 13.8657 3 10Z'}
										fill={'currentcolor'}/>
								</svg>
							</div>

						</div>
					</div>
				</div>
				<div>
					<label className={'text-neutral-600'}>&nbsp;</label>
					<div className={'mt-1 flex flex-row space-x-4'}>
						<div className={'flex flex-row space-x-0 divide-x border-x border-neutral-900'}>
							<Button
								onClick={(): void => set_category('standard')}
								variant={category === 'standard' ? 'filled' : 'outlined'}
								className={'yearn--button-smaller !border-x-0'}>
								{'Standard'}
							</Button>
							<Button
								onClick={(): void => set_category('factory')}
								variant={category === 'factory' ? 'filled' : 'outlined'}
								className={'yearn--button-smaller !border-x-0'}>
								{'Factory'}
							</Button>
							<Button
								onClick={(): void => set_category('all')}
								variant={category === 'all' ? 'filled' : 'outlined'}
								className={'yearn--button-smaller !border-x-0'}>
								{'All'}
							</Button>
						</div>
					</div>
				</div>
			</div>
			<div className={'flex w-full flex-row space-x-2 md:hidden md:w-2/3'}>
				<select
					className={'yearn--button-smaller !w-[120%] border-none bg-neutral-900 text-neutral-0'}
					onChange={(e): void => set_category(e.target.value)}>
					<option value={'standard'}>{'Standard'}</option>
					<option value={'factory'}>{'Factory'}</option>
					<option value={'all'}>{'All'}</option>
				</select>
				<div className={'flex h-8 w-full items-center border border-neutral-0 bg-neutral-0 p-2 md:w-auto'}>
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
	);
}

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
		} else if (category === 'factory') {
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
		if (sortBy === 'gauge') {
			return searchedGauges.sort((a, b): number => {
				const	aName = a.name;
				const	bName = b.name;
				if (sortDirection === 'desc') {
					return aName.localeCompare(bName);
				}
				return bName.localeCompare(aName);
			});
		} else if (sortBy === 'rewards') {
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
		} else if (sortBy === 'pendingRewards') {
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
				<TableHeader
					category={category}
					set_category={set_category}
					searchValue={searchValue}
					set_searchValue={set_searchValue} />
				<div className={'grid w-full grid-cols-1 pb-2 md:pb-4'}>
					<GaugeListHead
						sortBy={sortBy}
						sortDirection={sortDirection}
						onSort={(_sortBy: string, _sortDirection: string): void => {
							performBatchedUpdates((): void => {
								set_sortBy(_sortBy);
								set_sortDirection(_sortDirection);
							});
						}} />
					{sortedGauges.length === 0 ? (
						<GaugeListEmpty />
					) : sortedGauges.map((gauge): ReactNode => {
						if (!gauge) {
							return (null);
						}
						return <GaugeListRow key={gauge.name} currentGauge={gauge} />;
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
