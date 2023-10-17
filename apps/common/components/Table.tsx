/* eslint-disable tailwindcss/classnames-order */
import {useCallback, useMemo, useState} from 'react';
import {sort} from '@veYFI/utils';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {Pagination} from '@common/components/Pagination';
import {usePagination} from '@common/hooks/usePagination';
import {IconChevronPlain} from '@common/icons/IconChevronPlain';

import type {ReactElement} from 'react';

type TSortOrder = 'asc' | 'desc';

type TState<T> = {
	sortedBy: Extract<keyof T, string> | undefined;
	order: TSortOrder;
};

const switchOrder = (order: TSortOrder): TSortOrder => (order === 'desc' ? 'asc' : 'desc');

type TMetadata<T> = {
	key: Extract<keyof T, string>;
	label: string;
	className?: string;
	sortable?: boolean;
	fullWidth?: boolean;
	columnSpan?: number;
	isDisabled?: (item: T) => boolean;
	format?: (item: T) => string | number;
	transform?: (item: T) => ReactElement;
};

type TTableProps<T> = {
	metadata: TMetadata<T>[];
	data: T[];
	columns?: number;
	initialSortBy?: Extract<keyof T, string>;
	onRowClick?: (item: T) => void;
	itemsPerPage?: number;
	isLoading?: boolean;
};

export function Table<T>({
	metadata,
	data,
	columns,
	initialSortBy,
	onRowClick,
	itemsPerPage,
	isLoading
}: TTableProps<T>): ReactElement {
	const [{sortedBy, order}, set_state] = useState<TState<T>>({sortedBy: initialSortBy, order: 'desc'});

	const sortedData = useMemo((): T[] => {
		return sortedBy && order ? sort(data, sortedBy, order) : data;
	}, [data, order, sortedBy]);

	const {currentItems, paginationProps} = usePagination<T>({
		data: sortedData,
		itemsPerPage: itemsPerPage || sortedData.length
	});

	const handleSort = useCallback(
		(key: Extract<keyof T, string>): void => {
			const willChangeSortKey = sortedBy !== key;
			const newOrder = switchOrder(willChangeSortKey ? 'asc' : order);
			set_state({sortedBy: newOrder ? key : undefined, order: newOrder});
		},
		[order, sortedBy]
	);

	const gridColsVariants = {
		1: 'md:grid-cols-1',
		2: 'md:grid-cols-2',
		3: 'md:grid-cols-3',
		4: 'md:grid-cols-4',
		5: 'md:grid-cols-5',
		6: 'md:grid-cols-6',
		7: 'md:grid-cols-7',
		8: 'md:grid-cols-8',
		9: 'md:grid-cols-9',
		10: 'md:grid-cols-10',
		11: 'md:grid-cols-11',
		12: 'md:grid-cols-12',
		13: 'md:grid-cols-13'
	};

	const numberOfColumns = Math.min(columns ?? metadata.length, 13) as keyof typeof gridColsVariants;

	const colSpanVariants = {
		1: 'md:col-span-1',
		2: 'md:col-span-2',
		3: 'md:col-span-3',
		4: 'md:col-span-4',
		5: 'md:col-span-5',
		6: 'md:col-span-6',
		7: 'md:col-span-7',
		8: 'md:col-span-8',
		9: 'md:col-span-9',
		10: 'md:col-span-10',
		11: 'md:col-span-11',
		12: 'md:col-span-12',
		13: 'md:col-span-13'
	};

	return (
		<div className={'w-full'}>
			<div className={cl('mb-2 hidden w-full px-6 md:grid md:grid-flow-col', gridColsVariants[numberOfColumns])}>
				{metadata.map(
					({key, label, sortable, className, columnSpan}): ReactElement => (
						<button
							key={`header_${key}`}
							onClick={(): void => (sortable ? handleSort(key) : undefined)}
							disabled={!sortable}
							className={cl(
								'flex flex-row items-center justify-end space-x-1 first:justify-start',
								colSpanVariants[(columnSpan as keyof typeof gridColsVariants) ?? 1],
								className || ''
							)}>
							<p className={'text-xs text-neutral-500'}>{label}</p>
							{sortable && sortedBy === key && (
								<IconChevronPlain
									className={`yearn--sort-chevron ${order === 'asc' ? 'rotate-180' : ''}`}
								/>
							)}
							{sortable && sortedBy !== key && (
								<IconChevronPlain
									className={'yearn--sort-chevron--off text-neutral-300 group-hover:text-neutral-500'}
								/>
							)}
						</button>
					)
				)}
			</div>

			{currentItems.length === 0 && isLoading ? (
				<div className={'flex h-96 w-full flex-col items-center justify-center px-10 py-2'}>
					<b className={'text-lg'}>{'Fetching gauge data'}</b>
					<p className={'text-neutral-600'}>{'We are retrieving the gauges. Please wait.'}</p>
					<div className={'flex h-10 items-center justify-center'}>
						<span className={'loader'} />
					</div>
				</div>
			) : currentItems.length === 0 && !isLoading ? (
				<div className={'flex h-96 w-full flex-col items-center justify-center px-10 py-2'}>
					<b className={'text-lg'}>{'No Gauges'}</b>
					<p className={'text-neutral-600'}>{'No gauges available.'}</p>
				</div>
			) : null}
			{currentItems.map(
				(item, rowIndex): ReactElement => (
					<div
						key={`row_${rowIndex}`}
						className={cl(
							'grid w-full grid-cols-1 border-t border-neutral-200 px-4 py-2 transition-colors hover:bg-neutral-300 md:grid-flow-col md:border-none md:px-6',
							gridColsVariants[numberOfColumns],
							onRowClick ? 'cursor-pointer' : 'cursor-auto'
						)}
						onClick={(): void => onRowClick?.(item)}>
						{metadata.map(
							({
								key,
								label,
								className,
								fullWidth,
								columnSpan,
								format,
								transform,
								isDisabled
							}): ReactElement => {
								let isNumberLike = false;
								if (typeof item[key] === 'bigint') {
									isNumberLike = true;
								} else {
									isNumberLike = !isNaN(Number(item[key]));
								}
								const isNumber = isNumberLike;

								return (
									<div
										key={`cell_${key}_${rowIndex}`}
										className={cl(
											'flex h-8 flex-row items-center justify-between md:h-14 md:justify-end md:first:justify-start',
											colSpanVariants[(columnSpan as keyof typeof gridColsVariants) ?? 1],
											className
										)}>
										{!fullWidth && (
											<label className={'inline text-start text-sm text-neutral-500 md:hidden'}>
												{label}
											</label>
										)}
										<div
											className={cl(
												isDisabled && isDisabled?.(item)
													? 'text-neutral-400'
													: 'text-neutral-900',
												isNumber ? 'font-number' : 'font-aeonik',
												fullWidth ? 'w-full' : undefined
											)}>
											{transform?.(item) ?? format?.(item).toString() ?? String(item[key])}
										</div>
									</div>
								);
							}
						)}
					</div>
				)
			)}
			{itemsPerPage && (
				<div className={'mt-4'}>
					<div className={'border-t border-neutral-300 p-4 pb-0'}>
						<Pagination {...paginationProps} />
					</div>
				</div>
			)}
		</div>
	);
}
