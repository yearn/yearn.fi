import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {cl} from '@builtbymom/web3/utils';
import {IconCommunity} from '@common/icons/IconCommunity';
import {IconYearn} from '@common/icons/IconYearn';
import {IconYearnXApps} from '@common/icons/IconYearnXApps';
import {LogoDiscordRound} from '@common/icons/LogoDiscordRound';
import {LogoParagraphRound} from '@common/icons/LogoParagraphRound';
import {LogoTwitterRound} from '@common/icons/LogoTwitterRound';
import {LANDING_SIDEBAR_LINKS, MENU_TABS} from '@common/utils/constants';

import type {ReactElement} from 'react';

const iconsDict = {
	'/': <IconYearn />,
	community: <IconCommunity />,
	'yearn-x': <IconYearnXApps />
};

export function MobileNavbar({onClose}: {onClose: VoidFunction}): ReactElement {
	const pathName = usePathname();

	const currentTab = pathName?.startsWith('/home/') ? pathName?.split('/')[2] : '/';
	return (
		<div
			className={
				'flex h-full w-screen flex-col justify-end border-t border-gray-600/50 bg-gradient-to-b from-gray-900 to-[#1A1A1A] '
			}>
			<div className={'flex flex-col items-start gap-y-2 bg-transparent p-6 pb-4'}>
				{MENU_TABS.map(tab => (
					<Link
						className={cl(
							'text-base flex items-center gap-x-2 py-2 text-gray-400',
							currentTab === tab.route ? 'text-white' : 'text-gray-400'
						)}
						onClick={onClose}
						href={tab.route === '/' ? tab.route : `/home/${tab.route}`}>
						<div className={'flex size-6 items-center justify-center'}>
							{iconsDict[tab.route as '/' | 'community' | 'yearn-x']}
						</div>
						<p>{tab.title}</p>
					</Link>
				))}
			</div>

			<div className={'w-full border-t border-gray-500 p-6'}>
				<div className={'flex w-full justify-between'}>
					{LANDING_SIDEBAR_LINKS.slice(0, 5).map(link => (
						<Link
							href={link.href}
							className={'text-sm text-gray-400'}
							target={'_blank'}>
							{link.title}
						</Link>
					))}
				</div>

				<div className={'mt-6 flex gap-x-6'}>
					<Link
						target={'_blank'}
						href={'https://discord.com/invite/yearn'}>
						<LogoDiscordRound />
					</Link>
					<Link
						target={'_blank'}
						href={''}>
						<LogoParagraphRound />
					</Link>
					<Link
						target={'_blank'}
						href={'https://twitter.com/yearnfi'}>
						<LogoTwitterRound />
					</Link>
				</div>
			</div>
		</div>
	);
}
