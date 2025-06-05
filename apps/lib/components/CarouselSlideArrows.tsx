import {cl} from '@lib/utils';

import {IconChevron} from '../icons/IconChevron';

import type {ReactElement} from 'react';

type TCarouselSlideArrowsProps = {
	onScrollBack?: VoidFunction;
	onScrollForward?: VoidFunction;
	className?: string;
};

export function CarouselSlideArrows({
	onScrollBack,
	onScrollForward,
	className
}: TCarouselSlideArrowsProps): ReactElement {
	return (
		<div className={cl('flex w-full justify-between', className)}>
			<div />
			<div className={'hidden gap-3 md:flex'}>
				<button
					onClick={onScrollBack}
					className={
						'flex !h-8 items-center rounded-[4px] px-4 text-neutral-400 outline !outline-1 outline-neutral-200 hover:bg-neutral-200'
					}>
					<IconChevron className={'size-3 rotate-90 '} />
				</button>
				<button
					onClick={onScrollForward}
					className={
						'flex !h-8 items-center rounded-[4px] px-4 text-neutral-400 outline !outline-1 outline-neutral-200 hover:bg-neutral-200'
					}>
					<IconChevron className={'size-3 -rotate-90  '} />
				</button>
			</div>
		</div>
	);
}
