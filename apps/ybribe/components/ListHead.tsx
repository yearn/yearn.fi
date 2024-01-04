import {useCallback} from 'react';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {IconChevronPlain} from '@common/icons/IconChevronPlain';

import type {ReactElement} from 'react';
import type {TSortDirection} from '@common/types/types';

export type TListHead = {
	items: {
		label: string | ReactElement;
		value: string;
		sortable?: boolean;
		className?: string;
	}[];
	sortBy: string;
	sortDirection: TSortDirection;
	onSort: (sortBy: string, sortDirection: TSortDirection) => void;
};

export function ListHead({items, sortBy, sortDirection, onSort}: TListHead): ReactElement {
	const toggleSortDirection = (newSortBy: string): TSortDirection => {
		return sortBy === newSortBy
			? sortDirection === ''
				? 'desc'
				: sortDirection === 'desc'
					? 'asc'
					: 'desc'
			: 'desc';
	};

	const renderChevron = useCallback(
		(shouldSortBy: boolean): ReactElement => {
			if (shouldSortBy && sortDirection === 'desc') {
				return <IconChevronPlain className={'yearn--sort-chevron'} />;
			}
			if (shouldSortBy && sortDirection === 'asc') {
				return <IconChevronPlain className={'yearn--sort-chevron rotate-180'} />;
			}
			return (
				<IconChevronPlain
					className={'yearn--sort-chevron--off text-neutral-300 group-hover:text-neutral-500'}
				/>
			);
		},
		[sortDirection]
	);

	const [chain, token, ...rest] = items;
	return (
		<div className={'mt-4 grid w-full grid-cols-1 md:mt-0'}>
			<div className={cl('yearn--table-head-wrapper', 'grid-cols-12')}>
				<div className={cl('yearn--table-head-token-section flex flex-row space-x-2 col-span-4')}>
					<p className={'yearn--table-head-label'}>{chain.label}</p>
					<button
						onClick={(): void => onSort(token.value, toggleSortDirection(token.value))}
						className={'yearn--table-head-label-wrapper group mt-1'}>
						<p className={'yearn--table-head-label'}>{token.label}</p>
						{renderChevron(sortBy === token.value)}
					</button>
				</div>

				<div className={cl('yearn--table-head-data-section !grid', 'col-span-8 grid-cols-8')}>
					{rest.map(
						(item, index): ReactElement => (
							<button
								key={`${index}_${item.value}`}
								onClick={(): void => onSort(item.value, toggleSortDirection(item.value))}
								disabled={!item.sortable}
								className={cl('yearn--table-head-label-wrapper group', item.className)}
								datatype={'number'}>
								<p className={'yearn--table-head-label'}>&nbsp;{item.label}</p>
								{item.sortable ? renderChevron(sortBy === item.value) : null}
							</button>
						)
					)}
				</div>
			</div>
		</div>
	);
}
