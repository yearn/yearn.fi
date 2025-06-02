import {useMemo} from 'react';
import landingManifest from 'public/apps/landing-manifest.json';
import homeManifest from 'public/manifest.json';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';
import type {TDict} from '@builtbymom/web3/types';
import type {AppName} from '@common/components/Apps';

type TCurrentApp = {
	name: AppName | 'Home' | string;
	manifest: any;
	header?: ReactElement;
	menu: TMenu[];
};

export function useCurrentApp({pathname}: NextRouter): TCurrentApp {
	return useMemo((): TCurrentApp => {
		const appMapping: TDict<TCurrentApp> = {
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
