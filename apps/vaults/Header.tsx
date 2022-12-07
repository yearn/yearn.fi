import React from 'react';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';

import type {ReactElement} from 'react';

export 	const	MenuVaultsOptions = [
	{path: '/vaults', label: 'Vaults'},
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