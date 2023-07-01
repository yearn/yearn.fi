import {useState} from 'react';
import ReactPaginate from 'react-paginate';
import {useFetch} from '@common/hooks/useFetch';
import IconChevron from '@common/icons/IconChevron';
import {yDaemonGaugeRewardsFeedSchema} from '@common/schemas/yDaemonGaugeRewardsFeedSchema';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';
import {GaugeListEmpty} from '@yBribe/components/bribe/GaugeListEmpty';
import {RewardFeedTableRow} from '@yBribe/components/rewardFeed/RewardFeedTableRow';

import type {ReactElement, ReactNode} from 'react';
import type {TYDaemonGaugeRewardsFeed} from '@common/schemas/yDaemonGaugeRewardsFeedSchema';

export function RewardFeedTable(): ReactElement | null {
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: 1});
	const [itemOffset, set_itemOffset] = useState(0);
	const {isSuccess, data} = useFetch<TYDaemonGaugeRewardsFeed>({
		endpoint: `${yDaemonBaseUri}/bribes/newRewardFeed`,
		schema: yDaemonGaugeRewardsFeedSchema
	});

	if (!isSuccess || !data?.length) {
		return <GaugeListEmpty />;
	}

	const ITEMS_PER_PAGE = 15;
	const items = data.sort((a, b): number => b.timestamp - a.timestamp) ;
	const endOffset = itemOffset + ITEMS_PER_PAGE;
	const currentItems = items.slice(itemOffset, endOffset);
	const pageCount = Math.ceil(items.length / ITEMS_PER_PAGE);
	const handlePageClick = (event: {selected: number}): void => {
		const newOffset = (event.selected * ITEMS_PER_PAGE) % items.length;
		set_itemOffset(newOffset);
	};

	return (
		<>
			{currentItems.filter(Boolean).map((item, index): ReactNode =>
				<RewardFeedTableRow
					key={`${index}-${item.txHash}_${item.briber}_${item.rewardToken}`}
					currentRewardAdded={item} />
			)}
			<div className={'mt-4'}>
				<div className={'flex flex-col justify-between gap-4 border-t border-neutral-300 p-4 sm:flex-row sm:items-center sm:px-6'}>
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
					<div className={'hidden sm:flex sm:flex-1 sm:items-center sm:justify-between'}>
						<div>
							<p className={'text-gray-700 text-sm'}>
								{'Showing '}<span className={'font-medium'}>{endOffset - (ITEMS_PER_PAGE - 1)}</span>{' to '}<span className={'font-medium'}>{Math.min(endOffset, items.length)}</span>{' of'}{' '}
								<span className={'font-medium'}>{items.length}</span> {'results'}
							</p>
						</div>
						<ReactPaginate
							className={'isolate inline-flex -space-x-px rounded-md shadow-sm'}
							pageLinkClassName={'text-gray-500 hover:bg-neutral-300 relative inline-flex items-center px-4 py-2 text-sm font-medium focus:z-20 border border-neutral-400'}
							previousLinkClassName={'text-gray-500 hover:bg-neutral-300 relative inline-flex items-center p-2 text-sm font-medium focus:z-20 border border-neutral-400'}
							nextLinkClassName={'text-gray-500 hover:bg-neutral-300 relative inline-flex items-center p-2 text-sm font-medium focus:z-20 border border-neutral-400'}
							breakLinkClassName={'text-gray-700 relative inline-flex items-center px-4 py-2 text-sm font-medium hover:bg-neutral-300 border border-neutral-400'}
							activeLinkClassName={'text-gray-500 hover:bg-neutral-300 relative hidden items-center px-4 py-2 text-sm font-medium focus:z-20 md:inline-flex bg-neutral-300'}
							disabledLinkClassName={'cursor-not-allowed bg-neutral-100 hover:bg-neutral-100'}
							disabledClassName={'text-neutral-300'}
							renderOnZeroPageCount={(): null => null}
							breakLabel={'...'}
							onPageChange={handlePageClick}
							pageRangeDisplayed={5}
							pageCount={pageCount}
							nextLabel={<IconChevron className={'h-5 w-5 -rotate-90 transition-transform'} />}
							previousLabel={<IconChevron className={'h-5 w-5 rotate-90 transition-transform'} />}
						/>
					</div>
				</div>
			</div>
		</>
	);
}

