import {type ReactElement, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {ModalMobileMenu} from '@common/components/ModalMobileMenu';
import {IconBurgerPlain} from '@common/icons/IconBurgerPlain';
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
				<header className={'flex max-w-[1232px] items-center gap-4 py-1 md:justify-between md:!px-10 md:py-4'}>
					<div className={'hidden flex-row items-center gap-x-3 md:flex'}>
						<Link href={'/'}>
							<LogoYearn
								className={'size-7'}
								front={'text-black'}
								back={'text-white'}
							/>
						</Link>
						<span>{'Yearn'}</span>
					</div>
					<Navbar
						currentPathName={pathname || ''}
						nav={menu}
					/>
					<div className={'flex md:hidden'}>
						<button
							className={'flex size-8 items-center justify-center rounded-full bg-neutral-900/20 p-1.5'}
							onClick={(): void => set_isMenuOpen(!isMenuOpen)}>
							<span className={'sr-only'}>{'Open menu'}</span>
							<IconBurgerPlain />
						</button>
					</div>
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
