import {useCallback, useMemo, useState} from 'react';
import {sort} from '@veYFI/utils';
import IconChevronPlain from '@common/icons/IconChevronPlain';

import type {ReactElement} from 'react';

type TSortOrder = 'asc' | 'desc';

type TState<T> = {
	sortedBy: Extract<keyof T, string> | undefined, 
	order: TSortOrder
}

const switchOrder = (order: TSortOrder): TSortOrder => order === 'desc' ? 'asc' : 'desc';

type TMetadata<T> = {
	key: Extract<keyof T, string>;
	label: string;
	className?: string;
	sortable?: boolean;
	fullWidth?: boolean;
	columnSpan?: number;
	format?: (item: T) => string;
	transform?: (item: T) => ReactElement;
}
  
type TTableProps<T> = {
	metadata: TMetadata<T>[];
	data: T[];
	columns?: number;
	initialSortBy?: Extract<keyof T, string>;
	onRowClick?: (item: T) => void;
}

function Table<T>({metadata, data, columns, initialSortBy, onRowClick}: TTableProps<T>): ReactElement {
	const [{sortedBy, order}, set_state] = useState<TState<T>>({sortedBy: initialSortBy, order: 'desc'});
	
	const handleSort = useCallback((key: Extract<keyof T, string>): void => {
		const willChangeSortKey = sortedBy !== key;
		const newOrder = switchOrder(willChangeSortKey ? 'asc' : order);
		set_state({sortedBy: newOrder ? key : undefined, order: newOrder});
	}, [order, sortedBy]);
    
	const sortedData = useMemo((): T[] => {
		return sortedBy && order ? sort(data, sortedBy, order) : data;
	}, [data, order, sortedBy]);

	const numberOfColumns = Math.min(columns ?? (metadata.length), 12).toString();

	return (
		<div className={'w-full'}>
			<div className={`mb-2 hidden w-full px-6 md:grid md:grid-flow-col ${`md:grid-cols-${numberOfColumns}`}`}>
				{metadata.map(({key, label, sortable, className, columnSpan}): ReactElement => (
					<button
						key={`header_${key}`} 
						onClick={(): void => sortable ? handleSort(key) : undefined}
						disabled={!sortable}
						className={`flex flex-row items-center justify-end space-x-1 first:justify-start ${`md:col-span-${columnSpan ?? 1}`} ${className || ''}`}
					>
						<p className={'text-xs font-bold text-neutral-400'}>
							{label}
						</p>
						{sortable && sortedBy === key && <IconChevronPlain className={`yearn--sort-chevron ${order === 'asc' ? 'rotate-180' : ''}`} />}
						{sortable && sortedBy !== key && <IconChevronPlain className={'yearn--sort-chevron--off text-neutral-300 group-hover:text-neutral-500'} />}
					</button>
				))}
			</div>
			
			{sortedData.map((item, rowIndex): ReactElement => {
				return (
					<div 
						key={`row_${rowIndex}`} 
						className={`grid w-full grid-cols-1 border-t border-neutral-200 px-4 py-2 transition-colors hover:bg-neutral-300 md:grid-flow-col md:border-none md:px-6 ${`md:grid-cols-${numberOfColumns}`} ${onRowClick ? 'cursor-pointer' : 'cursor-auto'}`}
						onClick={(): void => onRowClick?.(item)}
					>
						{metadata.map(({key, label, className, fullWidth, columnSpan, format, transform}): ReactElement => {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							const isNumber = !isNaN(item[key] as any);
							const isZero = isNumber && Number(item[key]) === 0;
							return (
								<div key={`cell_${key}_${rowIndex}`} className={`flex h-8 flex-row items-center justify-between md:h-14 md:justify-end md:first:justify-start ${`md:col-span-${columnSpan ?? 1}`} ${className || ''}`}>
									{!fullWidth && <label className={'inline text-start text-sm text-neutral-500 md:hidden'}>{label}</label>}
									<div className={`${isZero ? 'text-neutral-400' : 'text-neutral-900'} ${isNumber ? 'font-number' : 'font-aeonik'} ${fullWidth ? 'w-full' : ''}`}>
										{transform?.(item) ?? format?.(item) ?? String(item[key])}
									</div>
								</div>
							);
						})}
					</div>
				);
			})}
		</div>
        
	);
}

export {Table};
