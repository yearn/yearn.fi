import React, {useCallback, useMemo, useState} from 'react';
import VaultListOptions from '@vaults/components/list/VaultListOptions';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import {useFilteredGauges} from '@yCRV/hooks/useFilteredGauges';
import {useSortGauges} from '@yCRV/hooks/useSortGauges';

import {GaugeListEmpty} from './GaugeListEmpty';
import {GaugeListRow} from './GaugeListRow';

import type {ReactElement, ReactNode} from 'react';
import type {TGaugesPossibleSortBy, TGaugesPossibleSortDirection} from '@yCRV/hooks/useSortGauges';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnGauge} from '@common/types/yearn';

function	GaugeList(): ReactElement {
	const	isLoadingGaugeList = true;
	const	gauges: TDict<TYearnGauge | undefined> = {};
	const	[sortBy, set_sortBy] = useState<TGaugesPossibleSortBy>('name');
	const	[sortDirection, set_sortDirection] = useState<TGaugesPossibleSortDirection>('');
	const	{searchValue, set_searchValue} = useAppSettings();
	const	[category, set_category] = useState('Standard');

	/* 🔵 - Yearn Finance **************************************************************************
	**	It's best to memorize the filtered gauges, which saves a lot of processing time by only
	**	performing the filtering once.
	**********************************************************************************************/
	const	standardGauges = useFilteredGauges(gauges, ({category}): boolean => category === 'Standard');
	const	factoryGauges = useFilteredGauges(gauges, ({category}): boolean => category === 'Factory');

	/* 🔵 - Yearn Finance **************************************************************************
	**	First, we need to determine in which category we are. The gaugesToDisplay function will
	**	decide which gauges to display based on the category. No extra filters are applied.
	**	The possible lists are memoized to avoid unnecessary re-renders.
	**********************************************************************************************/
	const	gaugesToDisplay = useMemo((): TYearnGauge[] => {
		let	_gaugeList: TYearnGauge[] = [...Object.values(gauges || {})] as TYearnGauge[];

		if (category === 'Standard') {
			_gaugeList = standardGauges;
		} else if (category === 'Factory') {
			_gaugeList = factoryGauges;
		}

		return _gaugeList;
	}, [category, factoryGauges, gauges, standardGauges]);

	/* 🔵 - Yearn Finance **************************************************************************
	**	Then, on the gaugesToDisplay list, we apply the search filter. The search filter is
	**	implemented as a simple string.includes() on the gauge name.
	**********************************************************************************************/
	const	searchedGauges = useMemo((): TYearnGauge[] => {
		if (searchValue === '') {
			return gaugesToDisplay;
		}
		return gaugesToDisplay.filter((gauge): boolean => {
			return gauge.name.toLowerCase().includes(searchValue.toLowerCase());
		});
	}, [gaugesToDisplay, searchValue]);

	/* 🔵 - Yearn Finance **************************************************************************
	**	Then, once we have reduced the list of gauges to display, we can sort them. The sorting
	**	is done via a custom method that will sort the gauges based on the sortBy and
	**	sortDirection values.
	**********************************************************************************************/
	const	sortedGaugesToDisplay = useSortGauges([...searchedGauges], sortBy, sortDirection);

	/* 🔵 - Yearn Finance **************************************************************************
	**	Callback method used to sort the gauges list.
	**	The use of useCallback() is to prevent the method from being re-created on every render.
	**********************************************************************************************/
	const	onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		performBatchedUpdates((): void => {
			set_sortBy(newSortBy as TGaugesPossibleSortBy);
			set_sortDirection(newSortDirection as TGaugesPossibleSortDirection);
		});
	}, []);

	/* 🔵 - Yearn Finance **************************************************************************
	**	The GaugeList component is memoized to prevent it from being re-created on every render.
	**	It contains either the list of gauges, is some are available, or a message to the user.
	**********************************************************************************************/
	const	GaugeList = useMemo((): ReactNode => {
		if (isLoadingGaugeList || sortedGaugesToDisplay.length === 0) {
			return (
				<GaugeListEmpty
					isLoading={isLoadingGaugeList}
					sortedGaugesToDisplay={sortedGaugesToDisplay}
					currentCategory={category} />
			);	
		}
		return (
			sortedGaugesToDisplay.map((gauge): ReactNode => {
				if (!gauge) {
					return (null);
				}
				return <GaugeListRow key={gauge.address} currentGauge={gauge} />;
			})
		);
	}, [category, isLoadingGaugeList, sortedGaugesToDisplay]);

	return (
		<div className={'relative col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'absolute top-8 right-8'}>
				<VaultListOptions />
			</div>
			<ListHero
				headLabel={'Vote for Gauge'}
				searchLabel={'Search'}
				searchPlaceholder={'f-yfieth'}
				categories={[
					[
						{value: 'Standard', label: 'Standard', isSelected: category === 'Standard'},
						{value: 'Factory', label: 'Factory', isSelected: category === 'Factory'},
						{value: 'All', label: 'All', isSelected: category === 'All'}

					]
				]}
				onSelect={set_category}
				searchValue={searchValue}
				set_searchValue={set_searchValue} />

			<ListHead
				sortBy={sortBy}
				sortDirection={sortDirection}
				onSort={onSort}
				items={[
					{label: 'Gauges', value: 'gauges', sortable: true},
					{label: 'Multi Select', value: 'multi-select', sortable: true, className: 'col-span-2'},
					{label: 'Number of yCrv votes', value: 'number-ycrv-votes', sortable: true, className: 'col-span-4'},
					{label: '', value: '', sortable: false, className: 'col-span-2'}
				]} />

			{GaugeList}
		</div>
	);
}

export default GaugeList;
