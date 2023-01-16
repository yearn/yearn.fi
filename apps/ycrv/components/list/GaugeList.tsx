import React, {useMemo, useState} from 'react';
import VaultListOptions from '@vaults/components/list/VaultListOptions';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';

import {GaugeListEmpty} from './GaugeListEmpty';
import {GaugeListRow} from './GaugeListRow';

import type {ReactElement, ReactNode} from 'react';
import type {TCurveGauges} from '@common/types/curves';

type TProps = {
	gauges: TCurveGauges[];
	isLoadingGauges: boolean;
}

function	GaugeList({gauges, isLoadingGauges}: TProps): ReactElement {
	const	{searchValue, set_searchValue} = useAppSettings();
	const	[category, set_category] = useState('Standard');


	/* 🔵 - Yearn Finance **************************************************************************
	**	The GaugeList component is memoized to prevent it from being re-created on every render.
	**	It contains either the list of gauges, is some are available, or a message to the user.
	**********************************************************************************************/
	const	GaugeList = useMemo((): ReactNode => {
		if (isLoadingGauges || gauges.length === 0) {
			return (
				<GaugeListEmpty
					isLoading={isLoadingGauges}
					gauges={gauges}
					currentCategory={category} />
			);	
		}
		return (
			gauges.map((gauge): ReactNode => {
				if (!gauge) {
					return (null);
				}
				return <GaugeListRow key={gauge.name} gauge={gauge} />;
			})
		);
	}, [category, gauges, isLoadingGauges]);

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
				sortBy={''}
				sortDirection={''}
				onSort={(): void => alert('Not implemented!')}
				items={[
					{label: 'Gauges', value: 'gauges', sortable: true},
					{label: 'Multi Select', value: 'multi-select', className: 'col-span-1'},
					{label: 'Number of yCrv votes', value: 'number-ycrv-votes', sortable: true, className: 'col-span-5'},
					{label: '', value: '', className: 'col-span-2'}
				]} />

			{GaugeList}
		</div>
	);
}

export default GaugeList;
