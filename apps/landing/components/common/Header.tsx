import {type ReactElement, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {ModalMobileMenu} from '@lib/components/ModalMobileMenu';
import {IconBurger} from '@lib/icons/IconBurger';
import {LogoYearn} from '@lib/icons/LogoYearn';

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
		const HOME_MENU = {path: '/apps', label: 'Apps'};

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
	}, []);

	return (
		<div
			id={'head'}
			className={'inset-x-0 top-0 z-50 mt-4 w-full md:mt-7'}>
			<div className={'w-full'}>
				<header className={'flex max-w-[1232px] items-center justify-between py-1 md:!px-10 md:py-4'}>
					<div className={'flex md:hidden'}>
						<button onClick={(): void => set_isMenuOpen(!isMenuOpen)}>
							<span className={'sr-only'}>{'Open menu'}</span>
							<IconBurger />
						</button>
					</div>
					<div className={'flex justify-center'}>
						<Link href={'/'}>
							<LogoYearn
								className={'size-10'}
								front={'text-black'}
								back={'text-white'}
							/>
						</Link>
					</div>
					<Navbar
						currentPathName={pathname || ''}
						nav={menu}
					/>
				</header>
			</div>
			<ModalMobileMenu
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
			</ModalMobileMenu>
		</div>
	);
}
