import React from 'react';
import meta from 'public/apps/ycrv-manifest.json';
import {AnimatePresence, motion} from 'framer-motion';
import Meta from '@common/components/Meta';
import {CurveContextApp} from '@common/contexts/useCurve';
import {variants} from '@common/utils/animations';
import {ExtendedWalletContextApp} from '@yCRV/contexts/useExtendedWallet';
import {YCRVContextApp} from '@yCRV/contexts/useYCRV';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

export default function Wrapper({children, router}: {children: ReactElement, router: NextRouter}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<ExtendedWalletContextApp>
				<YCRVContextApp>
					<CurveContextApp>
						<AnimatePresence mode={'wait'}>
							<motion.div
								key={router.asPath}
								initial={'initial'}
								animate={'enter'}
								exit={'exit'}
								className={'my-0 h-full md:mb-0 md:mt-16'}
								variants={variants}>
								{children}
							</motion.div>
						</AnimatePresence>
					</CurveContextApp>
				</YCRVContextApp>
			</ExtendedWalletContextApp>
		</>
	);
}
