import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {VaultMigrationContextApp} from '@vaults/contexts/useVaultsMigrations';
import {WalletForExternalMigrationsApp} from '@vaults/contexts/useWalletForExternalMigrations';
import {WalletForInternalMigrationsApp} from '@vaults/contexts/useWalletForInternalMigrations';
import Meta from '@common/components/Meta';

import type {ReactElement} from 'react';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<AppSettingsContextApp>
				<VaultMigrationContextApp>
					<WalletForInternalMigrationsApp>
						<WalletForExternalMigrationsApp>
							{children}
						</WalletForExternalMigrationsApp>
					</WalletForInternalMigrationsApp>
				</VaultMigrationContextApp>
			</AppSettingsContextApp>
		</>
	);
}