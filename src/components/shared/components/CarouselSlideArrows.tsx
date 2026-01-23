import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { IconChevron } from '../icons/IconChevron'

type TCarouselSlideArrowsProps = {
  onScrollBack?: VoidFunction
  onScrollForward?: VoidFunction
  className?: string
}

export function CarouselSlideArrows({
  onScrollBack,
  onScrollForward,
  className
}: TCarouselSlideArrowsProps): ReactElement {
  return (
    <div className={cl('flex w-full justify-between', className)}>
      <div />
      <div className={'hidden gap-2 md:flex'}>
        <button
          onClick={onScrollBack}
          className={
            'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-400 outline-solid outline-1! outline-neutral-200 hover:bg-neutral-200'
          }
        >
          <IconChevron className={'size-4 rotate-90'} />
        </button>
        <button
          onClick={onScrollForward}
          className={
            'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-neutral-400 outline-solid outline-1! outline-neutral-200 hover:bg-neutral-200'
          }
        >
          <IconChevron className={'size-4 -rotate-90'} />
        </button>
      </div>
    </div>
  )
}
