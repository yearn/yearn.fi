import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import {variants} from '@common/utils/animations';
import {YCRV_TOKEN_ADDRESS} from '@common/utils/constants';

import type {ReactElement} from 'react';

export 	const	MenuYCRVOptions = [
	{path: '/', label: 'Main'},
	{path: '/ycrv', label: 'yCRV'},
	{path: '/ycrv/holdings', label: 'Holdings'},
	{path: '/ycrv/about', label: 'About'}
];

export function MenuYCRV(): ReactElement {
	const	router = useRouter();

	return (
		<nav className={'yearn--nav'}>
			{MenuYCRVOptions.map((option): ReactElement => (
				<Link
					key={option.path}
					href={option.path}>
					<p className={`yearn--header-nav-item ${router.pathname === option.path ? 'active' : '' }`}>
						{option.label}
					</p>
				</Link>
			))}
		</nav>
	);
}

export function LogoYCRV(): ReactElement {
	const	router = useRouter();
	return (
		<motion.div
			key={'ycrv'}
			initial={'initial'}
			animate={router.pathname.startsWith('/ycrv') ? 'enter' : 'exit'}
			variants={variants}
			className={'absolute cursor-pointer'}>
			<Image
				alt={''}
				width={34}
				height={34}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		</motion.div>
	);
}