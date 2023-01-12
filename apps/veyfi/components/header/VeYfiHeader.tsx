import {AppName, APPS} from '@common/components/Apps';
import {MotionDiv} from '@common/components/MotionDiv';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

type TProps = {
	pathname: NextRouter['pathname'];
}

export function VeYfiHeader({pathname}: TProps): ReactElement {
	const {name, icon} = APPS[AppName.VEYFI];

	return (
		<MotionDiv
			animate={pathname.startsWith('/veyfi') ? 'enter' : 'exit'}
			name={name}>
			{icon}
		</MotionDiv>
	);
}
