import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {MigrableContextApp} from '@vaults/contexts/useMigrable';
import {MigrableWalletContextApp} from '@vaults/contexts/useMigrableWallet';
import Meta from '@common/components/Meta';

import type {ReactElement} from 'react';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<AppSettingsContextApp>
				<MigrableContextApp>
					<MigrableWalletContextApp>
						{children}
					</MigrableWalletContextApp>
				</MigrableContextApp>
			</AppSettingsContextApp>
		</>
	);
}