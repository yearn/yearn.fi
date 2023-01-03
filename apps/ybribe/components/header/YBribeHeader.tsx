import {AppName, APPS} from '@common/components/Apps';
import {MotionDiv} from '@common/components/MotionDiv';

import type {ReactElement} from 'react';

export function YBribeHeader(): ReactElement {
	const {name, icon} = APPS[AppName.YBRIBE];
	return (
		<MotionDiv animate={'enter'} name={name}>
			{icon}
		</MotionDiv>
	);
}
