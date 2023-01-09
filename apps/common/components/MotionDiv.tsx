import {motion} from 'framer-motion';
import {variants} from '@common/utils/animations';

import type {AnimationProps} from 'framer-motion';
import type {ReactElement} from 'react';

type TMotionDiv = {animate: AnimationProps['animate']; name: string; children: ReactElement};

export function MotionDiv({animate, name, children}: TMotionDiv): ReactElement {
	return (
		<motion.div
			key={name}
			initial={'initial'}
			animate={animate}
			variants={variants}
			className={'absolute cursor-pointer'}>
			{children}
		</motion.div>
	);
}
