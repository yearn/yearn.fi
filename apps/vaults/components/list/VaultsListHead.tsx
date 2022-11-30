import React from 'react';
import IconChevronPlain from '@common/icons/IconChevronPlain';

import type {ReactElement} from 'react';


function	VaultsListHead({
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
		<div className={'mb-2 hidden w-full grid-cols-8 px-10 md:grid'}>
			<div className={'col-span-3'}>
				<button
					onClick={(): void => onSort('token', sortBy === 'token' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-1 flex flex-row items-center justify-start space-x-1'}>
					<p className={'text-start text-base text-neutral-400'}>
						{'Token'}
					</p>
					{renderChevron(sortBy === 'token', sortDirection)}
				</button>
			</div>
			<div className={'col-span-5 grid grid-cols-8'}>
				<button
					onClick={(): void => onSort('apy', sortBy === 'apy' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-1 flex flex-row items-center justify-end space-x-1'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'APY'}
					</p>
					{renderChevron(sortBy === 'apy', sortDirection)}
				</button>

				<button
					onClick={(): void => onSort('available', sortBy === 'available' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-2 flex flex-row items-center justify-end space-x-1 px-7'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'Available'}
					</p>
					{renderChevron(sortBy === 'available', sortDirection)}
				</button>

				<button
					onClick={(): void => onSort('deposited', sortBy === 'deposited' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-2 flex flex-row items-center justify-end space-x-1 pl-7 pr-12'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'Deposited'}
					</p>
					{renderChevron(sortBy === 'deposited', sortDirection)}
				</button>

				<button
					onClick={(): void => onSort('tvl', sortBy === 'tvl' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-2 flex flex-row items-center justify-end space-x-1 px-7'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'TVL'}
					</p>
					{renderChevron(sortBy === 'tvl', sortDirection)}
				</button>

				<button
					onClick={(): void => onSort('risk', sortBy === 'risk' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'group col-span-1 flex flex-row items-center justify-end space-x-1'}>
					<p className={'text-end text-base text-neutral-400'}>
						{'Risk'}
					</p>
					{renderChevron(sortBy === 'risk', sortDirection)}
				</button>
			</div>
		</div>
	);
}

export {VaultsListHead};
