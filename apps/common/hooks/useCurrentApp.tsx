import {useMemo} from 'react';
import landingManifest from 'public/apps/landing-manifest.json';
import homeManifest from 'public/manifest.json';
import {VaultsHeader} from '@vaults/components/header/VaultsHeader';
import {AppName, APPS} from '@common/components/Apps';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';
import type {TDict} from '@lib/types';

type TCurrentApp = {
	name: AppName | 'Home' | string;
	manifest: any;
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
			'/landing': {
				name: 'Home',
				manifest: landingManifest,
				menu: []
			}
		};

		const currentApp = Object.keys(appMapping).find((path): boolean => pathname.startsWith(path));
		if (currentApp) {
			return appMapping[currentApp];
		}
		return {name: 'Home', manifest: homeManifest, menu: []};
	}, [pathname]);
}
