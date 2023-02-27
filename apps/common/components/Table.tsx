import {useCallback, useMemo, useState} from 'react';
import ReactPaginate from 'react-paginate';
import {sort} from '@veYFI/utils';
import IconChevronPlain from '@common/icons/IconChevronPlain';
import IconPaginationArrow from '@common/icons/IconPaginationArrow';

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
	const [itemOffset, set_itemOffset] = useState(0);
	
	const handleSort = useCallback((key: Extract<keyof T, string>): void => {
		const willChangeSortKey = sortedBy !== key;
		const newOrder = switchOrder(willChangeSortKey ? 'asc' : order);
		set_state({sortedBy: newOrder ? key : undefined, order: newOrder});
	}, [order, sortedBy]);
    
	const sortedData = useMemo((): T[] => {
		return sortedBy && order ? sort(data, sortedBy, order) : data;
	}, [data, order, sortedBy]);

	const numberOfColumns = Math.min(columns ?? (metadata.length), 12).toString();

	const ITEMS_PER_PAGE = 10;
	const endOffset = itemOffset + ITEMS_PER_PAGE;
	const currentItems = sortedData.slice(itemOffset, endOffset);
	const pageCount = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
	const handlePageClick = (event: {selected: number}): void => {
		const newOffset = (event.selected * ITEMS_PER_PAGE) % sortedData.length;
		set_itemOffset(newOffset);
	};

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
			
			{currentItems.map((item, rowIndex): ReactElement => {
				return (
					<div 
						key={`row_${rowIndex}`} 
						className={`grid w-full grid-cols-1 border-t border-neutral-200 px-4 py-2 transition-colors hover:bg-neutral-300 md:grid-flow-col md:border-none md:px-6 ${`md:grid-cols-${numberOfColumns}`} ${onRowClick ? 'cursor-pointer' : 'cursor-auto'}`}
						onClick={(): void => onRowClick?.(item)}
					>
						{metadata.map(({key, label, className, fullWidth, columnSpan, format, transform}): ReactElement => {
							const isNumber = !isNaN(item[key] as number);
							const isZero = isNumber && item[key] === 0;
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
			<div className={'mt-4'}>
				<div className={'border-t border-neutral-300 p-4 pb-0'}>
					<div className={'flex flex-1 justify-between sm:hidden'}>
						<a
							href={'#'}
							className={'border-gray-300 text-gray-700 hover:bg-gray-50 relative inline-flex items-center rounded-md border  px-4 py-2 text-sm font-medium'}
						>
							{'Previous'}
						</a>
						<a
							href={'#'}
							className={'border-gray-300 text-gray-700 hover:bg-gray-50 relative ml-3 inline-flex items-center rounded-md border  px-4 py-2 text-sm font-medium'}
						>
							{'Next'}
						</a>
					</div>
					<div className={'sm-border hidden sm:flex sm:items-center sm:justify-center'}>
						<div className={'ml-3 flex-1'}>
							<p className={'text-gray-700 text-sm'}>
								{'Showing '}<span className={'font-medium'}>{endOffset - (ITEMS_PER_PAGE - 1)}</span>{' to '}<span className={'font-medium'}>{Math.min(endOffset, sortedData.length)}</span>{' of'}{' '}
								<span className={'font-medium'}>{sortedData.length}</span> {'results'}
							</p>
						</div>
						<ReactPaginate
							className={'inline-flex align-middle'}
							pageLinkClassName={'text-[#5B5B5B] hover:border-b-2 inline-flex items-end mx-1.5 mt-2.5 px-0.5 text-xs'}
							previousLinkClassName={'inline-flex items-center m-2 font-medium'}
							nextLinkClassName={'inline-flex items-center m-2 font-medium'}
							breakLinkClassName={'text-[#5B5B5B] inline-flex items-center mx-2 my-2 px-0.5 font-medium'}
							activeLinkClassName={'text-gray-900 font-bold border-b-2 items-center mx-2 my-2 px-0.5 md:inline-flex'}
							disabledLinkClassName={'cursor-not-allowed hover:bg-neutral-100'}
							disabledClassName={'text-neutral-300'}
							renderOnZeroPageCount={(): null => null}
							breakLabel={'...'}
							onPageChange={handlePageClick}
							pageRangeDisplayed={3}
							pageCount={pageCount}
							previousLabel={<IconPaginationArrow className={'h-5 w-5 transition-transform'} />}
							nextLabel={<IconPaginationArrow className={'h-5 w-5 -rotate-180 transition-transform'} />}
						/>
						<div className={'sm:flex-1'}></div>
					</div>
				</div>
			</div>
		</div>
        
	);
}

export {Table};
