import React, {useCallback} from 'react';
import IconChevronPlain from '@common/icons/IconChevronPlain';

import type {ReactElement} from 'react';
import type {TPossibleSortDirection} from '@vaults/hooks/useSortVaults';

export type TListHead = {
	items: {
		label: string,
		value: string,
		sortable: boolean,
		className?: string
	}[],
	dataClassName?: string,
	sortBy: string,
	sortDirection: TPossibleSortDirection,
	onSort: (sortBy: string, sortDirection: TPossibleSortDirection) => void
}

function	ListHead({items, dataClassName, sortBy, sortDirection, onSort}: TListHead): ReactElement {
	const toggleSortDirection = (newSortBy: string): TPossibleSortDirection => {
		return sortBy === newSortBy ? (
			sortDirection === '' ? 'desc' : sortDirection === 'desc' ? 'asc' : 'desc'
		) : 'desc';
	};

	const	renderChevron = useCallback((shouldSortBy: boolean): ReactElement => {
		if (shouldSortBy && sortDirection === 'desc') {
			return <IconChevronPlain className={'yearn--sort-chevron'} />;
		}
		if (shouldSortBy && sortDirection === 'asc') {
			return <IconChevronPlain className={'yearn--sort-chevron rotate-180'} />;
		}
		return <IconChevronPlain className={'yearn--sort-chevron--off text-neutral-300 group-hover:text-neutral-500'} />;
	}, [sortDirection]);

	const	[first, ...rest] = items;
	return (
		<div className={'mt-4 grid w-full grid-cols-1 md:mt-0'}>
			<div className={'yearn--table-head-wrapper'}>
				<div className={'yearn--table-head-token-section'}>
					<button
						onClick={(): void => onSort(first.value, toggleSortDirection(first.value))}
						className={'yearn--table-head-label-wrapper group'}>
						<p className={'yearn--table-head-label'}>
							{first.label}
						</p>
						{renderChevron(sortBy === first.value)}
					</button>
				</div>

				<div className={`yearn--table-head-data-section ${dataClassName || ''}`}>
					{rest.map((item, index): ReactElement => (
						<button
							key={`${index}_${item.value}`}
							onClick={(): void => onSort(item.value, toggleSortDirection(item.value))}
							disabled={!item.sortable}
							className={`yearn--table-head-label-wrapper group ${item.className}`}
							datatype={'number'}>
							<p className={'yearn--table-head-label'}>
							&nbsp;{item.label}
							</p>
							{item.sortable ? renderChevron(sortBy === item.value) : null}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

export default ListHead;
