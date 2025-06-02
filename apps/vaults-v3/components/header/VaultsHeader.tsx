import {AppName, APPS} from '@common/components/Apps';
import {MotionDiv} from '@common/components/MotionDiv';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

type TProps = {
	pathname: NextRouter['pathname'];
};

export function VaultsV3Header({pathname}: TProps): ReactElement {
	const {name, icon} = APPS[AppName.VAULTS];
	const isVaultPage = pathname === '/v3/[chainID]/[address]';

	return (
		<MotionDiv
			animate={!isVaultPage && pathname.startsWith('/v3') ? 'enter' : 'exit'}
			name={name}>
			{icon}
		</MotionDiv>
	);
}
