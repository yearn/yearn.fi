import React, {ReactElement} from 'react';
import Meta from 'components/common/Meta';
import {CurveContextApp} from 'contexts/useCurve';
import {YCRVContextApp} from 'contexts/useYCRV';
import meta from 'public/apps/ycrv-manifest.json';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<YCRVContextApp>
				<CurveContextApp>
					{children}
				</CurveContextApp>
			</YCRVContextApp>
		</>
	);
}