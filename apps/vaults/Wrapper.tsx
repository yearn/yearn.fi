import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import {AnimatePresence, motion} from 'framer-motion';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {VaultMigrationContextApp} from '@vaults/contexts/useVaultsMigrations';
import {WalletForInternalMigrationsApp} from '@vaults/contexts/useWalletForInternalMigrations';
import Meta from '@common/components/Meta';
import {variants} from '@common/utils/animations';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

export default function Wrapper({children, router}: {children: ReactElement, router: NextRouter}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<AppSettingsContextApp>
				<VaultMigrationContextApp>
					<WalletForInternalMigrationsApp>
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
					</WalletForInternalMigrationsApp>
				</VaultMigrationContextApp>
			</AppSettingsContextApp>
		</>
	);
}
