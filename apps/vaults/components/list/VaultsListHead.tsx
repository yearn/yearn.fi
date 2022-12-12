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
			return <IconChevronPlain className={'yearn--sort-chevron'} />;
		}
		if (shouldSortBy && _sortDirection === 'asc') {
			return <IconChevronPlain className={'yearn--sort-chevron rotate-180'} />;
		}
		return <IconChevronPlain className={'yearn--sort-chevron--off text-neutral-300 group-hover:text-neutral-500'} />;
	}

	// const	items = [
	// 	{label: 'APY', value: 'apy', sortable: true}
	// ]

	return (
		<div className={'yearn--table-head-wrapper'}>
			<div className={'yearn--table-head-token-section'}>
				<button
					onClick={(): void => onSort('token', sortBy === 'token' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'yearn--table-head-label-wrapper group'}>
					<p className={'yearn--table-head-label'}>
						{'Token'}
					</p>
					{renderChevron(sortBy === 'token', sortDirection)}
				</button>
			</div>
			<div className={'yearn--table-head-data-section'}>
				<button
					onClick={(): void => onSort('apy', sortBy === 'apy' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'yearn--table-head-label-wrapper group col-span-2'}
					datatype={'number'}>
					<p className={'yearn--table-head-label'}>
						{'APY'}
					</p>
					{renderChevron(sortBy === 'apy', sortDirection)}
				</button>

				<button
					onClick={(): void => onSort('available', sortBy === 'available' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'yearn--table-head-label-wrapper group col-span-2'}
					datatype={'number'}>
					<p className={'yearn--table-head-label'}>
						{'Available'}
					</p>
					{renderChevron(sortBy === 'available', sortDirection)}
				</button>

				<button
					onClick={(): void => onSort('deposited', sortBy === 'deposited' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'yearn--table-head-label-wrapper group col-span-2'}
					datatype={'number'}>
					<p className={'yearn--table-head-label'}>
						{'Deposited'}
					</p>
					{renderChevron(sortBy === 'deposited', sortDirection)}
				</button>

				<button
					onClick={(): void => onSort('tvl', sortBy === 'tvl' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc')}
					className={'yearn--table-head-label-wrapper group col-span-2'}
					datatype={'number'}>
					<p className={'yearn--table-head-label'}>
						{'TVL'}
					</p>
					{renderChevron(sortBy === 'tvl', sortDirection)}
				</button>
			</div>
		</div>
	);
}

export {VaultsListHead};
