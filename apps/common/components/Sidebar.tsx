import {type ReactElement} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {cl} from '@builtbymom/web3/utils';
import {LogoYearn} from '@common/icons/LogoYearn';
import {iconsDict, LANDING_SIDEBAR_LINKS} from '@common/utils/constants';

import {PromoPoster} from './PromoPoster';

type TSidebarProps = {
	tabs: {route: string; title: string; isAcitve?: boolean}[];
};

export function Sidebar(props: TSidebarProps): ReactElement {
	const pathName = usePathname();
	const currentTab = pathName?.startsWith('/apps/') ? pathName?.split('/')[2] : 'apps';

	return (
		<div
			className={
				'flex h-full w-72 flex-col justify-between rounded-lg  from-gray-900 to-[#1A1A1A] py-6 text-white'
			}>
			<div className={'flex flex-col gap-y-4 '}>
				<div className={'mb-4 ml-2 flex flex-row items-center gap-x-3 px-4'}>
					<Link href={'/'}>
						<LogoYearn
							className={'size-6'}
							back={'text-blue-500'}
							front={'text-white'}
						/>
					</Link>
					<span>{'Yearn'}</span>
				</div>
				<div className={'px-4'}>
					<PromoPoster />
				</div>
				<div className={'mt-4 flex flex-col '}>
					{props.tabs.map(tab => {
						const href = tab.route === 'apps' ? `/${tab.route}` : `/apps/${tab.route}`;
						return (
							<Link
								className={cl(
									'py-2 px-[28px] flex gap-4 text-base hover:bg-gray-600/40',
									currentTab === tab.route ? 'text-white font-bold' : 'text-gray-400'
								)}
								shallow
								href={href}
								key={tab.route}>
								<div className={'flex size-6 items-center justify-center'}>
									{iconsDict[tab.route as keyof typeof iconsDict]}
								</div>
								<p>{tab.title}</p>
							</Link>
						);
					})}
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
