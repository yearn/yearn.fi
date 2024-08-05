import {type ReactElement, useCallback} from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {cl} from '@builtbymom/web3/utils';
import {useSearch} from '@common/contexts/useSearch';
import {LogoYearn} from '@common/icons/LogoYearn';
import {LANDING_SIDEBAR_LINKS} from '@common/utils/constants';

import {SearchBar} from './SearchBar';

type TSidebarProps = {
	tabs: {route: string; title: string; isAcitve?: boolean}[];
};

export function Sidebar(props: TSidebarProps): ReactElement {
	const pathName = usePathname();
	const router = useRouter();
	const {configuration, dispatch} = useSearch();

	const currentTab = pathName?.startsWith('/home/') ? pathName?.split('/')[2] : '/';

	const onSearchClick = useCallback(() => {
		if (!configuration.searchValue) {
			return;
		}
		router.push(`/home/search?query=${configuration.searchValue}`);
	}, [configuration.searchValue, router]);

	return (
		<div
			className={
				'flex h-full w-72 flex-col justify-between border border-gray-500/50 bg-gradient-to-b from-gray-900 to-[#1A1A1A] py-6 text-white'
			}>
			<div>
				<div className={'px-4'}>
					<LogoYearn
						className={'mb-10 size-10 pl-[10px]'}
						back={'text-blue-500'}
						front={'text-white'}
					/>
					<SearchBar
						className={cl(
							'!w-full !border-x-0 !border-t-0 !border-white !bg-gray-500 ',
							configuration.searchValue ? '!border-b-2' : '!border-b-0'
						)}
						searchPlaceholder={'Search Apps'}
						searchValue={configuration.searchValue}
						onSearch={(value: string) => {
							dispatch({type: 'SET_SEARCH', payload: value});
						}}
						shouldSearchByClick
						onSearchClick={onSearchClick}
					/>
				</div>
				<div className={'mt-8 flex flex-col'}>
					{props.tabs.map(tab => (
						<Link
							className={cl(
								'py-2 px-6 text-base hover:bg-gray-600/40',
								currentTab === tab.route ? 'text-white font-bold' : 'text-gray-400'
							)}
							href={tab.route === '/' ? tab.route : `/home/${tab.route}`}
							key={tab.route}>
							{tab.title}
						</Link>
					))}
				</div>
			</div>

			<div className={'flex flex-wrap gap-x-3 gap-y-4 px-6'}>
				{LANDING_SIDEBAR_LINKS.map(link => (
					<Link
						className={'text-xs text-gray-400 hover:text-white'}
						target={'_blank'}
						href={link.href}
						key={link.title}>
						{link.title}
					</Link>
				))}
			</div>
		</div>
	);
}
