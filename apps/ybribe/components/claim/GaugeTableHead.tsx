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
			return <IconChevronPlain className={'h-4 w-4 min-w-[16px] cursor-pointer text-neutral-500'} />;
		}
		if (shouldSortBy && _sortDirection === 'asc') {
			return <IconChevronPlain className={'h-4 w-4 min-w-[16px] rotate-180 cursor-pointer text-neutral-500'} />;
		}
		return <IconChevronPlain className={'h-4 w-4 min-w-[16px] cursor-pointer text-neutral-200/40 transition-colors group-hover:text-neutral-500'} />;
	}

	return (
		<div className={'mb-2 hidden w-full grid-cols-7 px-10 md:grid'}>
			<p className={'col-span-2 text-start text-base text-neutral-400'}>{'Token'}</p>
			<div className={'col-span-5 grid grid-cols-10 gap-10'}>
				<p className={'col-span-2 text-end text-base text-neutral-400'}>&nbsp;</p>

				<button
					onClick={(): void => onSort('rewards', sortBy === 'rewards' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-2 flex flex-row items-center justify-end space-x-1'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'$/veCRV'}
					</p>
					{renderChevron(sortBy === 'rewards', sortDirection)}
				</button>

				<div
					className={'group col-span-2 flex flex-row items-center justify-end space-x-1'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'APR'}
					</p>
				</div>

				<div
					className={'group col-span-2 flex flex-row items-center justify-end space-x-1'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'Claimable'}
					</p>
				</div>

				<p className={'col-span-2 text-end text-base text-neutral-400'}>&nbsp;</p>
			</div>
		</div>
	);
}

export {GaugeTableHead};