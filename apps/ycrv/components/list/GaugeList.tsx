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
	isLoadingGauges: boolean;
}

function	GaugeList({gauges, isLoadingGauges}: TProps): ReactElement {
	const	[votes, set_votes] = useState<TDict<boolean>>({});
	const	[category, set_category] = useState('Standard');
	const	[isSwitchEnabled, set_isSwitchEnabled] = useState(false);
	const 	[searchValue, set_searchValue] = useSessionStorage('yCRVVoteSearchValue', '');
	const	[sortBy, set_sortBy] = useState<TPossibleGaugesSortBy>('name');
	const	[sortDirection, set_sortDirection] = useState<TPossibleGaugesSortDirection>('');

	const	searchedGauges = useMemo((): TCurveGauges[] => {
		if (searchValue === '') {
			return gauges;
		}

		return gauges.filter(({name}): boolean => {
			return name.toLowerCase().includes(searchValue.toLowerCase());
		});
	}, [searchValue, gauges]);

	const	sortedGaugesToDisplay = useSortGauges([...searchedGauges], sortBy, sortDirection);

	const	onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		performBatchedUpdates((): void => {
			set_sortBy(newSortBy as TPossibleGaugesSortBy);
			set_sortDirection(newSortDirection as TPossibleGaugesSortDirection);
		});
	}, []);

	/* 🔵 - Yearn Finance **************************************************************************
	**	The GaugeList component is memoized to prevent it from being re-created on every render.
	**	It contains either the list of gauges, is some are available, or a message to the user.
	**********************************************************************************************/
	const	GaugeList = useMemo((): ReactNode => {
		if (isLoadingGauges || sortedGaugesToDisplay.length === 0) {
			return (
				<GaugeListEmpty
					isLoading={isLoadingGauges}
					gauges={sortedGaugesToDisplay}
					currentCategory={category} />
			);	
		}
		return (
			sortedGaugesToDisplay.map((gauge): ReactNode => {
				if (!gauge || (isSwitchEnabled && !votes[gauge.gauge])) {
					return (null);
				}
				return <GaugeListRow
					key={gauge.name}
					gauge={gauge}
					votes={votes}
					set_votes={set_votes} />;
			})
		);
	}, [category, isLoadingGauges, isSwitchEnabled, sortedGaugesToDisplay, votes]);

	const handleOnSwitch = (): void => {
		set_isSwitchEnabled((p): boolean => !p);
	};

	return (
		<div className={'relative col-span-12 flex w-full flex-col bg-neutral-100'}>
			<ListHero
				headLabel={'Vote for Gauges'}
				switchProps={{isEnabled: isSwitchEnabled, onSwitch: handleOnSwitch}}
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
					{label: 'Your votes', value: 'your-votes', className: 'col-span-2', sortable: true},
					{label: 'Put your votes', value: 'put-your-votes', className: 'col-span-4', sortable: true},
					{label: '', value: '', className: 'col-span-2'}
				]} />

			{GaugeList}
		</div>
	);
}

export default GaugeList;
