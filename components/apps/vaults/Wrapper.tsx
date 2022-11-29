import React, {ReactElement} from 'react';
import Meta from 'components/common/Meta';
import {CurveContextApp} from 'contexts/useCurve';
import meta from 'public/apps/vaults-manifest.json';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<CurveContextApp>
				{children}
			</CurveContextApp>
		</>
	);
}