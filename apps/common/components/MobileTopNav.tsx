import {type ReactElement, useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {useSearch} from '@common/contexts/useSearch';
import {IconBurger} from '@common/icons/IconBurger';
import {IconCross} from '@common/icons/IconCross';
import {IconSearch} from '@common/icons/IconSearch';
import {LogoYearn} from '@common/icons/LogoYearn';

import {SearchBar} from './SearchBar';

export function MobileTopNav({
	isSearchOpen,
	isNavbarOpen,
	set_isSearchOpen,
	set_isNavbarOpen
}: {
	isSearchOpen: boolean;
	isNavbarOpen: boolean;
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
			<div className={'flex w-full items-center justify-between bg-gray-900 p-6'}>
				<div className={'flex items-center'}>
					<button
						className={'mr-4 flex size-6 items-center justify-center'}
						onClick={() => set_isNavbarOpen(prev => !prev)}>
						{isNavbarOpen ? <IconCross /> : <IconBurger />}
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
				<button
					onClick={() => {
						set_isNavbarOpen(false);
						set_isSearchOpen(prev => !prev);
					}}>
					<IconSearch />
				</button>
			</div>

			{isSearchOpen && (
				<div className={'!w-full bg-gray-900 pb-6 pl-8 pr-6'}>
					<SearchBar
						className={
							'!max-w-none !rounded-lg !border-0 !border-none !bg-gray-700 text-white !outline-none '
						}
						searchValue={configuration.searchValue}
						onSearch={(value: string) => dispatch({searchValue: value})}
						searchPlaceholder={'Search Apps'}
						onSearchClick={onSearchClick}
						shouldSearchByClick
					/>
				</div>
			)}
		</div>
	);
}
