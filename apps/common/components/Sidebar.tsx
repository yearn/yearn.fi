import {type ReactElement, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {cl} from '@builtbymom/web3/utils';
import {LogoYearn} from '@common/icons/LogoYearn';

import {SearchBar} from './SearchBar';

type TSidebarProps = {
	tabs: {route: string; title: string; isAcitve?: boolean}[];
};

const links = [
	{title: 'Governance', href: 'https://gov.yearn.fi/'},
	{title: 'API', href: 'https://github.com/yearn/ydaemon'},
	{title: 'Docs', href: 'https://docs.yearn.fi/'},
	{title: 'Blog', href: 'https://blog.yearn.fi/'},
	{title: 'Support', href: 'https://discord.com/invite/yearn'},
	{title: 'Discord', href: 'https://discord.com/invite/yearn'},
	{title: 'Paragraph', href: ''},
	{title: 'Twitter', href: 'https://twitter.com/yearnfi'}
];

export function Sidebar(props: TSidebarProps): ReactElement {
	const [searchValue, set_searchValue] = useState('');
	const pathName = usePathname();

	const currentTab = pathName?.startsWith('/home/') ? pathName?.split('/')[2] : '/';

	return (
		<div
			className={
				'flex h-full w-72 flex-col justify-between border border-[#29292980] bg-white/5 px-4 py-6 text-white'
			}>
			<div>
				<LogoYearn
					className={'mb-10 size-10 pl-[10px]'}
					back={'text-blue-500'}
					front={'text-white'}
				/>
				<SearchBar
					className={'!w-full border-none !bg-gray-800'}
					searchPlaceholder={'Search Apps'}
					searchValue={searchValue}
					onSearch={set_searchValue}
				/>

				<div className={'ml-2 mt-8 flex flex-col'}>
					{props.tabs.map(tab => (
						<Link
							className={cl(
								'py-2 text-base',
								currentTab === tab.route ? 'text-white font-bold' : 'text-gray-400'
							)}
							href={tab.route === '/' ? tab.route : `/home/${tab.route}`}
							key={tab.route}>
							{tab.title}
						</Link>
					))}
				</div>
			</div>

			<div className={'flex flex-wrap gap-x-3 gap-y-4 px-2'}>
				{links.map(link => (
					<Link
						className={'text-xs text-gray-400'}
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
