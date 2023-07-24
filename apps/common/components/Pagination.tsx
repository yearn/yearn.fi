import ReactPaginate from 'react-paginate';
import IconPaginationArrow from '@common/icons/IconPaginationArrow';

import type {ReactElement} from 'react';

type TProps = {
	range: [from: number, to: number];
	pageCount: number;
	numberOfItems: number;
	onPageChange: (selectedItem: {
		selected: number;
	}) => void;
}

export function Pagination(props: TProps): ReactElement {
	const {range: [from, to], pageCount, numberOfItems, onPageChange} = props;

	return (
		<>
			<div className={'flex flex-1 justify-between sm:hidden'}>
				<a
					role={'button'}
					href={'#'}
					className={'border-gray-300 text-gray-700 hover:bg-gray-50 relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium'}
				>
					{'Previous'}
				</a>
				<a
					role={'button'}
					href={'#'}
					className={'border-gray-300 text-gray-700 hover:bg-gray-50 relative ml-3 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium'}
				>
					{'Next'}
				</a>
			</div>
			<div className={'sm-border hidden sm:flex sm:items-center sm:justify-center'}>
				<div className={'ml-3 flex-1'}>
					<p className={'text-sm text-[#5B5B5B]'}>
						{'Showing '}<span className={'font-medium'}>{from}</span>{' to '}<span className={'font-medium'}>{to}</span>{' of'}{' '}
						<span className={'font-medium'}>{numberOfItems}</span> {'results'}
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
					breakLabel={'...'}
					onPageChange={onPageChange}
					pageRangeDisplayed={3}
					pageCount={pageCount}
					previousLabel={<IconPaginationArrow className={'h-5 w-5 transition-transform'} />}
					nextLabel={<IconPaginationArrow className={'h-5 w-5 -rotate-180 transition-transform'} />}
				/>
				<div className={'sm:flex-1'}></div>
			</div>
		</>
	);
}
