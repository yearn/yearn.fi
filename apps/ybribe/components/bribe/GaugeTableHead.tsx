import React from 'react';
import IconChevronPlain from '@common/icons/IconChevronPlain';

import type {ReactElement} from 'react';

function	GaugeTableHead({
	sortBy,
	sortDirection,
	onSort
}: {
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
		<div className={'mb-2 hidden w-full grid-cols-7 px-10 md:grid'}>
			<p className={'col-span-2 text-start text-base text-neutral-400'}>{'Token'}</p>
			<div className={'col-span-5 grid grid-cols-10 gap-10'}>

				<div
					className={'group col-span-2 flex flex-row items-center justify-end space-x-1'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'Weight'}
					</p>
				</div>

				<button
					onClick={(): void => onSort('rewards', sortBy === 'rewards' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-3 flex flex-row items-center justify-end space-x-1 pr-0'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'Current $/veCRV'}
					</p>
					{renderChevron(sortBy === 'rewards', sortDirection)}
				</button>



				<button
					onClick={(): void => onSort('pendingRewards', sortBy === 'pendingRewards' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-3 flex flex-row items-center justify-end space-x-1 pr-0'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'Pending $/veCRV'}
					</p>
					{renderChevron(sortBy === 'pendingRewards', sortDirection)}
				</button>

				<p className={'col-span-2 text-end text-base text-neutral-400'}>&nbsp;</p>
			</div>
		</div>
	);
}

export {GaugeTableHead};