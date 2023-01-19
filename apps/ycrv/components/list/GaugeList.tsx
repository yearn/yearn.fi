import React, {useCallback, useMemo, useState} from 'react';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import {useSortGauges} from '@yCRV/hooks/useSortGauges';

import {GaugeListEmpty} from './GaugeListEmpty';
import {GaugeListRow} from './GaugeListRow';

import type {ReactElement, ReactNode} from 'react';
import type {TPossibleGaugesSortBy, TPossibleGaugesSortDirection} from '@yCRV/hooks/useSortGauges';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TCurveGauges} from '@common/types/curves';

type TProps = {
	gauges: TCurveGauges[];
	isLoading: boolean;
}

function	GaugeList({gauges, isLoading}: TProps): ReactElement {
	const	[votes, set_votes] = useState<TDict<number | undefined>>({});
	const	[category, set_category] = useState('All');
	const	[isSwitchEnabled, set_isSwitchEnabled] = useState(false);
	const 	[searchValue, set_searchValue] = useSessionStorage('yCRVGaugeSearchValue', '');
	const	[sortBy, set_sortBy] = useState<TPossibleGaugesSortBy>('gauges');
	const	[sortDirection, set_sortDirection] = useState<TPossibleGaugesSortDirection>('');

	const	searchedGauges = useMemo((): TCurveGauges[] => {
		if (searchValue === '') {
			return gauges;
		}

		return gauges.filter(({name}): boolean => {
			return name.toLowerCase().includes(searchValue.toLowerCase());
		});
	}, [searchValue, gauges]);


	const	onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		performBatchedUpdates((): void => {
			set_sortBy(newSortBy as TPossibleGaugesSortBy);
			set_sortDirection(newSortDirection as TPossibleGaugesSortDirection);
		});
	}, []);

	const	sortedGauges = useSortGauges({list: searchedGauges, sortBy, sortDirection, votes});

	/**
	 * Checks if there are no votes in all gauges
	 * Returns `true` if there are no votes; `false` otherwise.
	 */
	const	isVotesEmpty = useCallback((): boolean => Object.values(votes).length === 0, [votes]);

	/* 🔵 - Yearn Finance **************************************************************************
	**	The GaugeList component is memoized to prevent it from being re-created on every render.
	**	It contains either the list of gauges, is some are available, or a message to the user.
	**********************************************************************************************/
	const	GaugeList = useMemo((): ReactNode => {
		sortDirection; // TODO better trigger rendering when sort direction changes
		const gauges = sortedGauges.map((gauge): ReactElement | null => {
			if (!gauge || isSwitchEnabled && !votes[gauge.gauge]) {
				return null;
			}

			return (
				<GaugeListRow
					key={gauge.gauge}
					gauge={gauge}
					votes={votes}
					set_votes={set_votes}
				/>
			);
		});

		if (gauges.length === 0 || (isVotesEmpty() && isSwitchEnabled)) {
			return (
				<GaugeListEmpty
					isSwitchEnabled={isSwitchEnabled}
					searchValue={searchValue}
					category={category}
					set_category={set_category}
				/>
			);
		}

		return gauges;
	}, [category, isSwitchEnabled, isVotesEmpty, searchValue, sortDirection, sortedGauges, votes]);

	return (
		<div className={'relative col-span-12 flex w-full flex-col bg-neutral-100'}>
			<ListHero
				headLabel={'Vote for Gauges'}
				switchProps={{isEnabled: isSwitchEnabled, onSwitch: (): void => set_isSwitchEnabled((p): boolean => !p)}}
				searchLabel={'Search'}
				searchPlaceholder={'f-yfieth'}
				categories={[
					[
						// {value: 'Standard', label: 'Standard', isSelected: category === 'Standard'},
						// {value: 'Factory', label: 'Factory', isSelected: category === 'Factory'},
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
					{label: 'Current votes', value: 'current-votes', className: 'col-span-2', sortable: true},
					{label: 'Your votes', value: 'your-votes', className: 'col-span-2', sortable: true},
					{label: 'Put your votes', value: 'put-your-votes', className: 'col-span-3', sortable: true},
					{label: '', value: '', className: 'col-span-1'}
				]} />

			{isLoading ? <GaugeListEmpty isLoading category={category} /> : GaugeList}
		</div>
	);
}

export default GaugeList;
