import {cl} from 'builtbymom-web3-fork/utils';
import {IconEnter} from '@common/icons/IconEnter';
import {IconSearch} from '@common/icons/IconSearch';

import type {ChangeEvent, ReactElement} from 'react';

type TSearchBar = {
	searchPlaceholder: string;
	searchValue: string;
	onSearch: (searchValue: string) => void;
	className?: string;
	iconClassName?: string;
	inputClassName?: string;
	shouldSearchByClick?: boolean;
	onSearchClick?: () => void;
};

export function SearchBar(props: TSearchBar): ReactElement {
	return (
		<>
			<div
				className={cl(
					props.className,
					'mt-1 flex h-10 w-full max-w-md items-center border border-neutral-0 bg-neutral-0 p-2 md:w-2/3'
				)}>
				<div className={'relative flex h-10 w-full flex-row items-center justify-between'}>
					<input
						id={'search'}
						suppressHydrationWarning
						className={cl(
							props.inputClassName,
							'h-10 w-full overflow-x-scroll border-none bg-transparent pl-2 px-0 py-2 text-base outline-none scrollbar-none placeholder:text-neutral-400'
						)}
						type={'text'}
						placeholder={props.searchPlaceholder}
						value={props.searchValue || ''}
						onChange={(e: ChangeEvent<HTMLInputElement>): void => {
							props.onSearch(e.target.value);
						}}
						onKeyDown={e => {
							if (!props.shouldSearchByClick) return;
							if (e.key === 'Enter') {
								return props.onSearchClick?.();
							}
						}}
					/>
					<div
						role={props.shouldSearchByClick ? 'button' : 'div'}
						onClick={() => props.onSearchClick?.()}
						className={cl(props.iconClassName, 'absolute right-0 text-neutral-400')}>
						{props.shouldSearchByClick && props.searchValue ? (
							<div className={'rounded-md border border-gray-500 p-[6px]'}>
								<IconEnter className={'size-3'} />
							</div>
						) : (
							<IconSearch />
						)}
					</div>
				</div>
			</div>
		</>
	);
}
