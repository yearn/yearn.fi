import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {MigratableContextApp} from '@vaults/contexts/useMigratable';
import {MigratableWalletContextApp} from '@vaults/contexts/useMigratableWallet';
import Meta from '@common/components/Meta';

import type {ReactElement} from 'react';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<AppSettingsContextApp>
				<MigratableContextApp>
					<MigratableWalletContextApp>
						{children}
					</MigratableWalletContextApp>
				</MigratableContextApp>
			</AppSettingsContextApp>
		</>
	);
}