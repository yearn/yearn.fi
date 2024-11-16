import {type ReactElement, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {AppName, APPS} from '@common/components/Apps';
import {LogoYearn} from '@common/icons/LogoYearn';

type TMenu = {path: string; label: string | ReactElement; target?: string};
type TNavbar = {nav: TMenu[]; currentPathName: string};

function Navbar({nav, currentPathName}: TNavbar): ReactElement {
	return (
		<nav className={'hidden items-center gap-6 md:flex'}>
			{nav.map(
				(option): ReactElement => (
					<Link
						key={option.path}
						target={option.target}
						href={option.path}>
						<p className={`yearn--header-nav-item ${currentPathName === option.path ? 'active' : ''}`}>
							{option?.label || 'Unknown'}
						</p>
					</Link>
				)
			)}
		</nav>
	);
}

export function LandingAppHeader(): ReactElement {
	const {pathname} = useRouter();
	const [isMenuOpen, set_isMenuOpen] = useState<boolean>(false);

	const menu = useMemo((): TMenu[] => {
		const HOME_MENU = {path: '/', label: 'Home'};

		if (pathname.startsWith('/ycrv')) {
			return [HOME_MENU, ...APPS[AppName.YCRV].menu];
		}

		if (pathname.startsWith('/v3')) {
			return [HOME_MENU, ...APPS[AppName.VAULTSV3].menu];
		}

		if (pathname.startsWith('/vaults')) {
			return [HOME_MENU, ...APPS[AppName.VAULTS].menu];
		}

		if (pathname.startsWith('/veyfi')) {
			return [HOME_MENU, ...APPS[AppName.VEYFI].menu];
		}

		return [
			HOME_MENU,
			{
				path: 'https://gov.yearn.fi/',
				label: 'Governance',
				target: '_blank'
			},
			{path: 'https://blog.yearn.fi/', label: 'Blog', target: '_blank'},
			{path: 'https://docs.yearn.fi/', label: 'Docs', target: '_blank'},
			{path: 'https://discord.gg/yearn', label: 'Support', target: '_blank'}
		];
	}, [pathname]);

	return (
		<div
			id={'head'}
			className={'inset-x-0 top-0 z-50 mt-7 w-full'}>
			<div className={'w-full'}>
				<header className={'yearn--header mx-auto max-w-6xl md:!px-10'}>
					<div className={'flex md:hidden'}>
						<button onClick={(): void => set_isMenuOpen(!isMenuOpen)}>
							<span className={'sr-only'}>{'Open menu'}</span>
							<svg
								className={'text-neutral-500'}
								width={'40'}
								height={'40'}
								viewBox={'0 0 40 40'}
								fill={'none'}
								xmlns={'http://www.w3.org/2000/svg'}>
								<path
									d={
										'M2 2C1.44772 2 1 2.44772 1 3C1 3.55228 1.44772 4 2 4H22C22.5523 4 23 3.55228 23 3C23 2.44772 22.5523 2 22 2H2Z'
									}
									fill={'currentcolor'}
								/>
								<path
									d={
										'M2 8C1.44772 8 1 8.44772 1 9C1 9.55228 1.44772 10 2 10H14C14.5523 10 15 9.55228 15 9C15 8.44772 14.5523 8 14 8H2Z'
									}
									fill={'currentcolor'}
								/>
								<path
									d={
										'M1 15C1 14.4477 1.44772 14 2 14H22C22.5523 14 23 14.4477 23 15C23 15.5523 22.5523 16 22 16H2C1.44772 16 1 15.5523 1 15Z'
									}
									fill={'currentcolor'}
								/>
								<path
									d={
										'M2 20C1.44772 20 1 20.4477 1 21C1 21.5523 1.44772 22 2 22H14C14.5523 22 15 21.5523 15 21C15 20.4477 14.5523 20 14 20H2Z'
									}
									fill={'currentcolor'}
								/>
							</svg>
						</button>
					</div>
					<div className={'flex justify-center'}>
						<LogoYearn
							className={'size-10'}
							front={'text-black'}
						/>
					</div>
					<Navbar
						currentPathName={pathname || ''}
						nav={menu}
					/>
				</header>
			</div>
			{/* <ModalMobileMenu
				shouldUseWallets={true}
				shouldUseNetworks={true}
				isOpen={isMenuOpen}
				onClose={(): void => set_isMenuOpen(false)}
				supportedNetworks={[]}>
				{menu?.map(
					(option): ReactElement => (
						<Link
							key={option.path}
							href={option.path}>
							<div
								className={'mobile-nav-item'}
								onClick={(): void => set_isMenuOpen(false)}>
								<p className={'font-bold'}>{option.label}</p>
							</div>
						</Link>
					)
				)}
			</ModalMobileMenu> */}
		</div>
	);
}
