import {cl} from 'builtbymom-web3-fork/utils';
import {CATEGORY_PAGE_FILTERS} from '@common/utils/constants';

import type {ReactElement} from 'react';

function FilterItem({isActive, title}: {isActive: boolean; title: string}): ReactElement {
	return (
		<div
			className={cl(
				'border-1 whitespace-nowrap max-h-10 px-6 py-2 text-base text-white border',
				isActive ? 'border-white' : 'border-white/15'
			)}>
			{title}
		</div>
	);
}

export function FilterBar({selectedFilter}: {selectedFilter: {title: string; value: string}}): ReactElement {
	return (
		<div className={'flex'}>
			{CATEGORY_PAGE_FILTERS.map(filter => (
				<FilterItem
					title={filter.title}
					isActive={filter.value === selectedFilter.value}
					key={filter.value}
				/>
			))}
		</div>
	);
}
