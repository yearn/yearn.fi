import {type ReactElement, useState} from 'react';
import {IconChevron} from '@common/icons/IconChevron';

function SortItem({isActive, title}: {isActive: boolean; title: string}): ReactElement {
	return <div className={`px-6 py-2 ${isActive ? 'font-bold text-white' : 'text-gray-400'}`}>{title}</div>;
}

export function SortingBar(): ReactElement {
	const [isOpen, set_isOpen] = useState(false);
	return (
		<>
			<button
				onClick={() => set_isOpen(prev => !prev)}
				className={'relative flex items-center'}>
				<p className={'mr-2 text-xs text-white'}>{'Sort by Popularity'}</p>
				<IconChevron className={`size-6 text-white ${isOpen && 'rotate-180'}`} />
			</button>
			{isOpen && (
				<div
					className={
						'border-1 absolute top-28 z-30 w-80 border border-gray-700 bg-gray-500 py-2 text-white max-sm:left-0 md:right-1 md:top-10'
					}>
					{Array(4)
						.fill('List Item')
						.map((item, i) => (
							<SortItem
								isActive={i === 2}
								title={item}
							/>
						))}
				</div>
			)}
		</>
	);
}
