import {AppName, APPS} from '@common/components/Apps';
import {MotionDiv} from '@common/components/MotionDiv';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

type TProps = {
	pathname: NextRouter['pathname'];
}

export function VaultsHeader({pathname}: TProps): ReactElement {
	const {name, icon} = APPS[AppName.VAULTS];
	const isVaultPage = pathname === '/vaults/[chainID]/[address]';

	return (
		<MotionDiv animate={!isVaultPage && 'enter'} name={name}>
			{icon}
		</MotionDiv>
	);
}
