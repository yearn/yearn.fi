import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {VaultMigrationContextApp} from '@vaults/contexts/useVaultsMigrations';
import {WalletForInternalMigrationsApp} from '@vaults/contexts/useWalletForInternalMigrations';
import Meta from '@common/components/Meta';

import {WalletForZapApp} from './contexts/useWalletForZaps';

import type {ReactElement} from 'react';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<AppSettingsContextApp>
				<VaultMigrationContextApp>
					<WalletForInternalMigrationsApp>
						{/* <WalletForExternalMigrationsApp> */}
						<WalletForZapApp>
							{children}
						</WalletForZapApp>
						{/* </WalletForExternalMigrationsApp> */}
					</WalletForInternalMigrationsApp>
				</VaultMigrationContextApp>
			</AppSettingsContextApp>
		</>
	);
}