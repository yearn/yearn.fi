import React from 'react';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';

import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/layouts/Header.next';

export const	MenuYBribeOptions: TMenu[] = [
	{path: '/ybribe', label: 'Claim bribe'},
	{path: '/ybribe/offer-bribe', label: 'Offer bribe'},
	{path: '/ybribe/about', label: 'About'}
];

export function LogoYBribe(): ReactElement {
	const	router = useRouter();
	return (
		<motion.div
			key={'yBribe'}
			initial={'initial'}
			animate={router.pathname.startsWith('/ybribe') ? 'enter' : 'exit'}
			variants={variants}
			className={'absolute cursor-pointer'}>
			<LogoYearn
				className={'h-8 w-8'}
				back={'text-neutral-900'}
				front={'text-neutral-0'} />
		</motion.div>
	);
}
