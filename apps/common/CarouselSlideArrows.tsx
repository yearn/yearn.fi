import {cl} from '@builtbymom/web3/utils';

import {IconChevron} from './icons/IconChevron';

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
						'flex !h-8 items-center rounded-[4px] px-4 text-neutral-900 outline !outline-1 outline-gray-600/50 hover:bg-gray-600/40'
					}>
					<IconChevron className={'size-3 rotate-90'} />
				</button>
				<button
					onClick={onScrollForward}
					className={
						'flex !h-8 items-center rounded-[4px] px-4 text-neutral-900 outline !outline-1 outline-gray-600/50 hover:bg-gray-600/40'
					}>
					<IconChevron className={'size-3 -rotate-90'} />
				</button>
			</div>
		</div>
	);
}
