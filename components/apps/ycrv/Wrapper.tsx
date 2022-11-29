import React, {ReactElement} from 'react';
import {CurveContextApp} from 'contexts/useCurve';
import {YCRVContextApp} from 'contexts/useYCRV';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<YCRVContextApp>
			<CurveContextApp>
				{children}
			</CurveContextApp>
		</YCRVContextApp>
	);
}