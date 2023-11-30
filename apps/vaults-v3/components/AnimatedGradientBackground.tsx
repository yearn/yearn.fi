import {motion} from 'framer-motion';
import {cl} from '@yearn-finance/web-lib/utils/cl';

import type {ReactElement} from 'react';

export function AnimatedGradientBackgroundForV3(): ReactElement {
	return (
		<motion.div
			transition={{duration: 10, delay: 0, repeat: Infinity, ease: 'linear'}}
			animate={{
				background: [
					`linear-gradient(0deg, #D21162 24.91%, #2C3DA6 99.66%)`,
					`linear-gradient(360deg, #D21162 24.91%, #2C3DA6 99.66%)`
				]
			}}
			className={cl('absolute inset-0', 'pointer-events-none')}
		/>
	);
}
