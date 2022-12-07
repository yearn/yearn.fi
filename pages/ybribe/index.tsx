import React, {useCallback, useMemo, useState} from 'react';
import Link from 'next/link';
import {BigNumber} from 'ethers';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';
import {GaugeTableEmpty} from '@yBribe/components/claim/GaugeTableEmpty';
import {GaugeTableHead} from '@yBribe/components/claim/GaugeTableHead';
import {GaugeTableRow} from '@yBribe/components/claim/GaugeTableRow';
import {useBribes} from '@yBribe/contexts/useBribes';
import Wrapper from '@yBribe/Wrapper';

import type {ChangeEvent, ReactElement, ReactNode} from 'react';
import type {TCurveGauges} from '@common/types/curves';

function	GaugeList(): ReactElement {
	const	{tokens, prices} = useYearn();
	const	{currentRewards, nextRewards, claimable} = useBribes();
	const	{gauges} = useCurve();
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
		if (category === 'claimable') {
			return gauges.filter((gauge): boolean => {
				const currentClaimableMapV2 = Object.values(claimable?.v2?.[toAddress(gauge.gauge)] || {});
				const currentClaimableMapV3 = Object.values(claimable?.v3?.[toAddress(gauge.gauge)] || {});
				return [...currentClaimableMapV2, ...currentClaimableMapV3].some((value: BigNumber): boolean => value.gt(0));
			});
		}
		if (category === 'v2') {
			return gauges.filter((gauge): boolean => {
				const hasCurrentRewardsV2 = currentRewards?.v2?.[toAddress(gauge.gauge)] !== undefined;
				return hasCurrentRewardsV2;
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
						<h2 className={'text-lg font-bold md:text-3xl'}>{'Claim Bribe'}</h2>
					</div>
					<div className={'hidden flex-row space-x-4 md:flex'}>
						<Button
							onClick={(): void => set_category('claimable')}
							variant={category === 'claimable' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'Claimable'}
						</Button>
						<Button
							onClick={(): void => set_category('all')}
							variant={category === 'all' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'All'}
						</Button>
						<Button
							onClick={(): void => set_category('v2')}
							variant={category === 'v2' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'Legacy'}
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
							<option value={'claimable'}>{'Claimable'}</option>
							<option value={'all'}>{'All'}</option>
							<option value={'v2'}>{'Legacy'}</option>
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
						<GaugeTableEmpty category={category} />
					) : sortedGauges.map((gauge): ReactNode => {
						if (!gauge) {
							return (null);
						}
						return <GaugeTableRow
							key={gauge.name}
							currentGauge={gauge}
							category={category} />;
					})}
				</div>
			</div>
		</section>
	);
}

function	Index(): ReactElement {
	return (
		<>
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<b className={'text-center text-lg md:text-2xl'}>{'Get more for your votes.'}</b>
				<p className={'mt-8 whitespace-pre-line text-center text-base text-neutral-600'}>
					{'Sell your vote to the highest bidder by voting on the briber\'s gauge and claiming a reward.\nIt\'s like DC lobbying, but without the long lunches.'}
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

Index.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default Index;