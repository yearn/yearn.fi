import React from 'react';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';

import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/layouts/Header.next';

export 	const	MenuVeYFIOptions: TMenu[] = [
	{path: '/veyfi', label: 'veYFI'},
	{path: 'https://docs.yearn.finance/contributing/governance/veyfi', label: 'Docs', target: '_blank'}
];

export function LogoVeYFI(): ReactElement {
	const router = useRouter();

	return (
		<motion.div
			key={'veyfi'}
			initial={'initial'}
			animate={router.pathname.startsWith('/veyfi') ? 'enter' : 'exit'}
			variants={variants}
			className={'absolute cursor-pointer'}>
			<LogoYearn
				className={'h-8 w-8'}
				back={'text-primary'}
				front={'text-white'} />
		</motion.div>
	);
}
