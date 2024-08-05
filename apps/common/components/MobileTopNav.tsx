import {type ReactElement, useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {useSearch} from '@common/contexts/useSearch';
import {IconBurger} from '@common/icons/IconBurger';
import {IconSearch} from '@common/icons/IconSearch';
import {LogoYearn} from '@common/icons/LogoYearn';

import {SearchBar} from './SearchBar';

export function MobileTopNav({
	isSearchOpen,
	set_isSearchOpen,
	set_isNavbarOpen
}: {
	isSearchOpen: boolean;
	set_isSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
	set_isNavbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}): ReactElement {
	const {configuration, dispatch} = useSearch();
	const router = useRouter();

	const onSearchClick = useCallback(() => {
		if (!configuration.searchValue) {
			return;
		}
		router.push(`/home/search?query=${configuration.searchValue}`);
	}, [configuration.searchValue, router]);

	return (
		<div className={'z-50 bg-gray-900'}>
			<div className={'flex w-full justify-between bg-gray-900 p-6'}>
				<div className={'flex items-center'}>
					<button
						className={'mr-4'}
						onClick={() => set_isNavbarOpen(prev => !prev)}>
						<IconBurger />
					</button>
					<button
						onClick={() => {
							router.push('/');
							set_isSearchOpen(false);
						}}>
						<LogoYearn
							className={'size-8'}
							back={'text-blue-500'}
							front={'text-white'}
						/>
					</button>
				</div>
				<div>
					<button
						onClick={() => {
							set_isNavbarOpen(false);
							set_isSearchOpen(prev => !prev);
						}}>
						<IconSearch />
					</button>
				</div>
			</div>

			{isSearchOpen && (
				<div className={'!w-full bg-gray-900 px-6 pb-6'}>
					<SearchBar
						className={'!max-w-none !border-0 !border-white !bg-gray-500 text-white '}
						searchValue={configuration.searchValue}
						onSearch={(value: string) => dispatch({type: 'SET_SEARCH', payload: value})}
						searchPlaceholder={'Search Apps'}
						onSearchClick={onSearchClick}
						shouldSearchByClick
					/>
				</div>
			)}
		</div>
	);
}
