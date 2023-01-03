import {AppName, APPS} from '@common/components/Apps';
import {MotionDiv} from '@common/components/MotionDiv';

import type {ReactElement} from 'react';

export function YCrvHeader(): ReactElement {
	const {name, icon} = APPS[AppName.YCRV];
	return (
		<MotionDiv animate={'enter'} name={name}>
			{icon}
		</MotionDiv>
	);
}
