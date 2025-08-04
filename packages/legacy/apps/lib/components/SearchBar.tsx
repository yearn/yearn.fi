import {IconEnter} from '@lib/icons/IconEnter';
import {IconSearch} from '@lib/icons/IconSearch';
import {cl} from '@lib/utils';
import {useDebouncedCallback} from '@react-hookz/web';
import {type ChangeEvent, type ReactElement, useEffect, useState} from 'react';

type TSearchBar = {
	searchPlaceholder: string;
	searchValue: string;
	onSearch: (searchValue: string) => void;
	className?: string;
	iconClassName?: string;
	inputClassName?: string;
	shouldSearchByClick?: boolean;
	shouldDebounce?: boolean;
	onSearchClick?: () => void;
};

export function SearchBar(props: TSearchBar): ReactElement {
	/**********************************************************************************************
	 ** Create local search state for immediate UI feedback while debouncing the actual search
	 ** functionality. This provides a responsive user experience while preventing excessive
	 ** filtering operations and URL updates that could degrade performance.
	 *********************************************************************************************/
	const [localSearchValue, setLocalSearchValue] = useState<string>(props.searchValue || '');

	/**********************************************************************************************
	 ** Create a debounced search handler that delays the actual search operation by 300ms.
	 ** This prevents excessive filtering and URL updates while the user is actively typing,
	 ** improving both performance and user experience.
	 *********************************************************************************************/
	const debouncedSearch = useDebouncedCallback(
		(searchValue: string) => {
			props.onSearch(searchValue);
		},
		[props.onSearch],
		1000
	);

	/**********************************************************************************************
	 ** Handle search input changes by immediately updating the local state for UI responsiveness
	 ** and triggering the debounced search operation for the actual filtering.
	 *********************************************************************************************/
	const handleSearchChange = (searchValue: string): void => {
		setLocalSearchValue(searchValue);
		if (props.shouldDebounce) {
			debouncedSearch(searchValue);
			return;
		}
		props.onSearch(searchValue);
	};

	/**********************************************************************************************
	 ** Synchronize local search state when the search prop changes from external sources
	 ** such as URL navigation, browser back/forward, or programmatic updates.
	 *********************************************************************************************/
	useEffect(() => {
		setLocalSearchValue(props.searchValue || '');
	}, [props.searchValue]);

	return (
		<div
			className={cl(
				props.className,
				'flex h-10 w-full max-w-md items-center border border-neutral-0 bg-neutral-0 p-2 md:w-2/3'
			)}
		>
			<div className={'relative flex h-10 w-full flex-row items-center justify-between'}>
				<input
					id={'search'}
					suppressHydrationWarning
					className={cl(
						props.inputClassName,
						'text-[14px] h-10 w-full overflow-x-scroll border-none bg-transparent pl-2 px-0 py-2 text-base outline-none scrollbar-none placeholder:text-neutral-400'
					)}
					type={'text'}
					placeholder={props.searchPlaceholder}
					value={localSearchValue || ''}
					onChange={(e: ChangeEvent<HTMLInputElement>): void => {
						handleSearchChange(e.target.value);
					}}
					onKeyDown={e => {
						if (!props.shouldSearchByClick) {
							return;
						}
						if (e.key === 'Enter') {
							return props.onSearchClick?.();
						}
					}}
				/>
				<div
					role={props.shouldSearchByClick ? 'button' : 'div'}
					onClick={() => props.onSearchClick?.()}
					className={cl(props.iconClassName, 'absolute right-[10px] top-[12px] text-neutral-400')}
				>
					{props.shouldSearchByClick && props.searchValue ? (
						<div className={'rounded-md border border-gray-500 p-[6px]'}>
							<IconEnter className={'size-3'} />
						</div>
					) : (
						<IconSearch className={'size-4'} />
					)}
				</div>
			</div>
		</div>
	);
}
