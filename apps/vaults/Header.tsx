import React, {Fragment} from 'react';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';

import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/layouts/Header.next';

export 	const	MenuVaultsOptions: TMenu[] = [
	{path: '/vaults', label: 'Vaults'},
	{
		path: '/vaults/migrate',
		label: (
			<Fragment>
				{'Migrate'}
				<span className={'absolute -top-0 -right-2 flex h-2 w-2'}>
					<span className={'absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-600 opacity-75'}></span>
					<span className={'relative inline-flex h-2 w-2 rounded-full bg-pink-500'}></span>
				</span>
			</Fragment>
		)
	},
	{path: '/vaults/about', label: 'About'}
];

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