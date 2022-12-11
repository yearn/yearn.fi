import React from 'react';
import meta from 'public/apps/ycrv-manifest.json';
import Meta from '@common/components/Meta';
import {CurveContextApp} from '@common/contexts/useCurve';
import {YCRVContextApp} from '@yCRV/contexts/useYCRV';

import {ExtendedWalletContextApp} from './contexts/useExtendedWallet';

import type {ReactElement} from 'react';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<ExtendedWalletContextApp>
				<YCRVContextApp>
					<CurveContextApp>
						{children}
					</CurveContextApp>
				</YCRVContextApp>
			</ExtendedWalletContextApp>
		</>
	);
}