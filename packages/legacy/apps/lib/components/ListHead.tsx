import {IconChevronPlain} from '@lib/icons/IconChevronPlain';
import type {TSortDirection} from '@lib/types';
import {cl} from '@lib/utils';

import type {ReactElement} from 'react';
import {useCallback} from 'react';

export type TListHead = {
	items: {
		label: string | ReactElement;
		value: string;
		sortable?: boolean;
		className?: string;
	}[];
	dataClassName?: string;
	wrapperClassName?: string;
	tokenClassName?: string;
	sortBy: string;
	sortDirection: TSortDirection;
	onSort: (sortBy: string, sortDirection: TSortDirection) => void;
};

export function ListHead({
	items,
	dataClassName,
	wrapperClassName,
	tokenClassName,
	sortBy,
	sortDirection,
	onSort
}: TListHead): ReactElement {
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
			<div className={cl('mb-2 hidden w-full px-10 md:grid md:grid-cols-12', wrapperClassName)}>
				<div className={cl('col-span-4 flex gap-6', tokenClassName)}>
					<p className={'yearn--table-head-label max-w-[32px]'}>{chain.label}</p>
					<button
						onClick={(): void => onSort(token.value, toggleSortDirection(token.value))}
						className={'yearn--table-head-label-wrapper group'}>
						<p className={'yearn--table-head-label'}>{token.label}</p>
						{renderChevron(sortBy === token.value)}
					</button>
				</div>

				<div />
				<div className={cl('col-span-7 grid grid-cols-10 gap-1', dataClassName)}>
					{rest.map(
						(item, index): ReactElement => (
							<button
								key={`${index}_${item.value}`}
								onClick={(): void => onSort(item.value, toggleSortDirection(item.value))}
								disabled={!item.sortable}
								className={cl('yearn--table-head-label-wrapper group', item.className)}
								datatype={'number'}>
								<p className={'yearn--table-head-label whitespace-nowrap'}>&nbsp;{item.label}</p>
								{item.sortable ? renderChevron(sortBy === item.value) : null}
							</button>
						)
					)}
				</div>
			</div>
		</div>
	);
}
