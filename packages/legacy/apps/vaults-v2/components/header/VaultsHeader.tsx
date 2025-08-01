import {APPS, AppName} from '@lib/components/Apps';
import {MotionDiv} from '@lib/components/MotionDiv';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

type TProps = {
	pathname: NextRouter['pathname'];
};

export function VaultsHeader({pathname}: TProps): ReactElement {
	const {name, icon} = APPS[AppName.VAULTS];
	const isVaultPage = pathname === '/vaults/[chainID]/[address]';

	return (
		<MotionDiv animate={!isVaultPage && pathname.startsWith('/vaults') ? 'enter' : 'exit'} name={name}>
			{icon}
		</MotionDiv>
	);
}
