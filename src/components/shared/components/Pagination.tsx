import { IconPaginationArrow } from '@shared/icons/IconPaginationArrow'
import type { ReactElement } from 'react'
import ReactPaginate from 'react-paginate'

type TProps = {
  range: [from: number, to: number]
  pageCount: number
  numberOfItems: number
  onPageChange: (selectedItem: { selected: number }) => void
  currentPage?: number
}

export function Pagination({
  range: [from, to],
  pageCount,
  numberOfItems,
  onPageChange,
  currentPage = 0
}: TProps): ReactElement {
  const handlePrevious = (): void => {
    if (currentPage === 0) {
      return
    }
    onPageChange({ selected: currentPage - 1 })
  }

  const handleNext = (): void => {
    if (currentPage >= pageCount - 1) {
      return
    }
    onPageChange({ selected: currentPage + 1 })
  }

  return (
    <>
      <div className={'flex flex-1 justify-between gap-4 md:hidden'}>
        <button
          onClick={handlePrevious}
          disabled={currentPage <= 0}
          className={
            'hover:bg-gray-50 relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-neutral-200 px-4 py-2 text-sm text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40'
          }
        >
          {'Previous'}
        </button>
        <button
          onClick={handleNext}
          disabled={currentPage >= pageCount - 1}
          className={
            'hover:bg-gray-50 relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-neutral-200 px-4 py-2 text-sm text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40'
          }
        >
          {'Next'}
        </button>
      </div>
      <div className={'hidden md:flex md:items-center md:justify-center'}>
        <div className={'ml-3 flex-1'}>
          <small className={'text-xs text-[#5B5B5B]'}>
            {'Showing '}
            <span className={'font-medium'}>{from}</span>
            {' to '}
            <span className={'font-medium'}>{to}</span>
            {' of'} <span className={'font-medium'}>{numberOfItems}</span> {'results'}
          </small>
        </div>
        <ReactPaginate
          className={'inline-flex align-middle'}
          pageLinkClassName={'text-[#5B5B5B] hover:border-b-2 inline-flex items-end mx-1.5 mt-2.5 px-0.5 text-xs'}
          previousLinkClassName={'inline-flex min-h-[44px] min-w-[44px] items-center justify-center m-1 font-medium'}
          nextLinkClassName={'inline-flex min-h-[44px] min-w-[44px] items-center justify-center m-1 font-medium'}
          breakLinkClassName={'text-[#5B5B5B] inline-flex items-center mx-2 my-2 px-0.5 font-medium'}
          activeLinkClassName={'text-neutral-900 font-medium border-b-2 items-center mx-2 my-2 px-0.5 md:inline-flex'}
          disabledLinkClassName={'cursor-not-allowed hover:bg-neutral-100'}
          disabledClassName={'text-neutral-300'}
          breakLabel={'...'}
          onPageChange={onPageChange}
          pageRangeDisplayed={3}
          pageCount={pageCount}
          forcePage={currentPage}
          previousLabel={<IconPaginationArrow className={'size-4 opacity-10 transition-opacity hover:opacity-100'} />}
          nextLabel={
            <IconPaginationArrow className={'size-4 -rotate-180 opacity-10 transition-opacity hover:opacity-100'} />
          }
        />
        <div className={'md:flex-1'}></div>
      </div>
    </>
  )
}
