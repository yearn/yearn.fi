import {useMemo} from 'react';
import {VeYfiHeader} from 'apps/veyfi/components/header/VeYfiHeader';
import homeManifest from 'public/manifest.json';
import {VaultsHeader} from '@vaults/components/header/VaultsHeader';
import {AppName, APPS} from '@common/components/Apps';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';
import type {TDict} from '@builtbymom/web3/types';
import type {TMetaFile} from '@common/components/Meta';

type TCurrentApp = {
	name: AppName | 'Home' | string;
	manifest: TMetaFile;
	header?: ReactElement;
	menu: TMenu[];
};

export function useCurrentApp({pathname}: NextRouter): TCurrentApp {
	return useMemo((): TCurrentApp => {
		const appMapping: TDict<TCurrentApp> = {
			'/v3': {
				...APPS[AppName.VAULTSV3],
				header: <VaultsHeader pathname={pathname} />
			},
			'/vaults': {
				...APPS[AppName.VAULTS],
				header: <VaultsHeader pathname={pathname} />
			},
			'/veyfi': {
				...APPS[AppName.VEYFI],
				header: <VeYfiHeader pathname={pathname} />
			}
		};

		const currentApp = Object.keys(appMapping).find((path): boolean => pathname.startsWith(path));
		if (currentApp) {
			return appMapping[currentApp];
		}
		return {name: 'Home', manifest: homeManifest, menu: []};
	}, [pathname]);
}
