import React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';

import type {ReactElement} from 'react';

export const	MenuYBribeOptions = [
	{path: '/', label: 'Main'},
	{path: '/ybribe', label: 'Claim bribe'},
	{path: '/ybribe/offer-bribe', label: 'Offer bribe'},
	{path: '/ybribe/about', label: 'About'}
];

export function MenuYBribe(): ReactElement {
	const	router = useRouter();

	return (
		<nav className={'col-s hidden w-1/3 flex-row items-center space-x-3 md:flex md:space-x-6'}>
			{MenuYBribeOptions.map((option): ReactElement => (
				<Link key={option.path} href={option.path}>
					<p className={`yearn--header-nav-item ${router.pathname === option.path ? 'active' : '' }`}>
						{option.label}
					</p>
				</Link>
			))}
		</nav>
	);	
}

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