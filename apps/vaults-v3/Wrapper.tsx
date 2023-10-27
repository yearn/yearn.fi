import {type NextRouter} from 'next/router';
import {QueryParamProvider} from 'use-query-params';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {StakingRewardsContextApp} from '@vaults/contexts/useStakingRewards';
import {WalletForZapAppContextApp} from '@vaults/contexts/useWalletForZaps';
import Meta from '@common/components/Meta';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {NextQueryParamAdapter} from '@common/utils/QueryParamsProvider';

import type {ReactElement} from 'react';

export function Wrapper({children, router}: {children: ReactElement; router: NextRouter}): ReactElement {
	const {manifest} = useCurrentApp(router);

	return (
		<>
			<Meta meta={manifest} />
			<AppSettingsContextApp>
				<WalletForZapAppContextApp>
					<StakingRewardsContextApp>
						<QueryParamProvider
							adapter={NextQueryParamAdapter}
							options={{removeDefaultsFromUrl: true, updateType: 'replaceIn'}}>
							{children}
						</QueryParamProvider>
					</StakingRewardsContextApp>
				</WalletForZapAppContextApp>
			</AppSettingsContextApp>
		</>
	);
}
