import React from 'react';
import IconChevronPlain from '@common/icons/IconChevronPlain';

import type {ReactElement} from 'react';

const	items = [
	{label: 'Weight', value: 'weight', sortable: false, className: 'col-span-1'},
	{label: 'Current $/veCRV', value: 'rewards', sortable: true, className: 'col-span-3'},
	{label: 'Pending $/veCRV', value: 'pendingRewards', sortable: true, className: 'col-span-3'},
	{label: '', value: '', sortable: false, className: 'col-span-1'}
];

function	GaugeListHead({sortBy, sortDirection, onSort}: {
	sortBy: string,
	sortDirection: string,
	onSort: (sortBy: string, sortDirection: string) => void
}): ReactElement {
	function	renderChevron(shouldSortBy: boolean, _sortDirection: string): ReactElement {
		if (shouldSortBy && _sortDirection === 'desc') {
			return <IconChevronPlain className={'yearn--sort-chevron'} />;
		}
		if (shouldSortBy && _sortDirection === 'asc') {
			return <IconChevronPlain className={'yearn--sort-chevron rotate-180'} />;
		}
		return <IconChevronPlain className={'yearn--sort-chevron--off text-neutral-300 group-hover:text-neutral-500'} />;
	}

	return (
		<div className={'yearn--table-head-wrapper'}>
			<div className={'yearn--table-head-token-section'}>
				<button
					onClick={(): void => onSort('gauge', sortBy === 'gauge' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'yearn--table-head-label-wrapper group'}>
					<p className={'yearn--table-head-label'}>
						{'Gauge'}
					</p>
					{renderChevron(sortBy === 'gauge', sortDirection)}
				</button>
			</div>

			<div className={'yearn--table-head-data-section grid-cols-9'}>
				{items.map((item): ReactElement => (
					<button
						key={item.value}
						onClick={(): void => onSort(item.value, sortBy === item.value ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
						disabled={!item.sortable}
						className={`yearn--table-head-label-wrapper group ${item.className}`}
						datatype={'number'}>
						<p className={'yearn--table-head-label'}>
							{item.label}&nbsp;
						</p>
						{item.sortable ? renderChevron(sortBy === item.value, sortDirection) : null}
					</button>
				))}
			</div>
		</div>
	);
}

export {GaugeListHead};