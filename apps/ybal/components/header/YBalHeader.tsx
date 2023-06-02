import {AppName, APPS} from '@common/components/Apps';
import {MotionDiv} from '@common/components/MotionDiv';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

type TProps = {
	pathname: NextRouter['pathname'];
}

export function YBalHeader({pathname}: TProps): ReactElement {
	const {name, icon} = APPS[AppName.YBAL];

	return (
		<MotionDiv
			animate={pathname.startsWith('/ybal') ? 'enter' : 'exit'}
			name={name}>
			{icon}
		</MotionDiv>
	);
}
