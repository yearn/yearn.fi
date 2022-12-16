import React from 'react';
import Image from 'next/image';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import {YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {variants} from '@common/utils/animations';

import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/layouts/Header.next';

export 	const	MenuYCRVOptions: TMenu[] = [
	{path: '/ycrv', label: 'yCRV'},
	{path: '/ycrv/holdings', label: 'Holdings'},
	{path: '/ycrv/about', label: 'About'}
];

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