import React, {ReactElement} from 'react';
import {CurveContextApp} from 'contexts/useCurve';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<CurveContextApp>
			{children}
		</CurveContextApp>
	);
}