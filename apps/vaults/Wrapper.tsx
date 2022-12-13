import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import {ExtendedWalletContextApp} from '@vaults/contexts/useExtendedWallet';
import {MigrableContextApp} from '@vaults/contexts/useMigrable';
import {MigrableFromDeFiWalletContextApp} from '@vaults/contexts/useMigrableFromDeFi';
import {MigrableWalletContextApp} from '@vaults/contexts/useMigrableWallet';
import Meta from '@common/components/Meta';

import type {ReactElement} from 'react';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
			<MigrableContextApp>
				<MigrableWalletContextApp>
					<MigrableFromDeFiWalletContextApp>
						<ExtendedWalletContextApp>
							{children}
						</ExtendedWalletContextApp>
					</MigrableFromDeFiWalletContextApp>
				</MigrableWalletContextApp>
			</MigrableContextApp>
		</>
	);
}