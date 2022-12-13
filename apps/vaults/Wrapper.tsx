import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {ExtendedWalletContextApp} from '@vaults/contexts/useExtendedWallet';
import {MigratableContextApp} from '@vaults/contexts/useMigratable';
import {MigratableFromDeFiWalletContextApp} from '@vaults/contexts/useMigratableFromDeFi';
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
						<MigratableFromDeFiWalletContextApp>
							<ExtendedWalletContextApp>
								{children}
							</ExtendedWalletContextApp>
						</MigratableFromDeFiWalletContextApp>
					</MigratableWalletContextApp>
				</MigratableContextApp>
			</AppSettingsContextApp>
		</>
	);
}