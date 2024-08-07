import Image from 'next/image';
import Link from 'next/link';
import {motion} from 'framer-motion';
import {cl} from '@builtbymom/web3/utils';

import type {ReactElement} from 'react';
import type {TApp} from '@common/types/category';

export function FeaturedApp(props: {app: TApp}): ReactElement {
	return (
		<Link
			href={props.app.appURI}
			target={'_blank'}
			className={cl(
				'group relative flex cursor-pointer flex-col justify-end px-6 py-10 rounded-lg z-20 overflow-hidden outline outline-1 outline-gray-700/50 h-[272px] min-w-[272px]'
			)}>
			<motion.div
				className={'absolute inset-0 bottom-[120px] md:bottom-0'}
				initial={{y: 0}}
				whileHover={{y: -50}}
				transition={{duration: 0.3}}>
				<Image
					src={props.app.logoURI}
					alt={props.app.name}
					priority={true}
					width={1400}
					height={2000}
					className={'right-0 top-0 size-full bg-center object-cover transition-all duration-200'}
				/>
			</motion.div>

			<motion.div
				className={
					'pointer-events-none absolute bottom-[120px] left-0 z-20 h-[120px] w-full bg-gray-800 p-6 text-white transition-all md:bottom-0 md:group-hover:bottom-[120px]'
				}
				initial={{y: '100%'}}
				transition={{duration: 0.2}}>
				{props.app.description}
			</motion.div>
		</Link>
	);
}
