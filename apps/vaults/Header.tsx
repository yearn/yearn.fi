import React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';

import type {ReactElement} from 'react';

export 	const	MenuVaultsOptions = [
	{path: '/', label: 'Main'},
	{path: '/vaults', label: 'Vaults'},
	{path: '/vaults/about', label: 'About'}
];

export function MenuVaults(): ReactElement {
	const	router = useRouter();
	return (
		<nav className={'col-s hidden w-1/3 flex-row items-center space-x-3 md:flex md:space-x-6'}>
			{MenuVaultsOptions.map((option): ReactElement => (
				<Link key={option.path} href={option.path}>
					<p className={`yearn--header-nav-item ${router.pathname === option.path ? 'active' : '' }`}>
						{option.label}
					</p>
				</Link>
			))}
		</nav>
	);	
}

export function LogoVaults(): ReactElement {
	const	router = useRouter();
	const	isVaultPage = router.pathname === '/vaults/[chainID]/[address]';

	return (
		<motion.div
			key={'vaults'}
			initial={'initial'}
			animate={!isVaultPage && router.pathname.startsWith('/vaults') ? 'enter' : 'exit'}
			variants={variants}
			className={'absolute cursor-pointer'}>
			<LogoYearn
				className={'h-8 w-8'}
				back={'text-pink-400'}
				front={'text-white'} />
		</motion.div>
	);
}