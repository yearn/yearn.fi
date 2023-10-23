import {useMemo} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';

import type {ReactElement} from 'react';
import type {PartialLocation, QueryParamAdapterComponent} from 'use-query-params';

export const NextQueryParamAdapter: QueryParamAdapterComponent = ({children}): ReactElement | null => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const adapter = useMemo((): any => {
		return {
			replace(location: PartialLocation): void {
				router.replace(pathname + location.search, {scroll: false});
			},
			push(location: PartialLocation): void {
				router.push(pathname + location.search, {scroll: false});
			},
			get location(): {search: string} {
				return {
					search: searchParams.toString()
				};
			}
		};
	}, [router, pathname, searchParams]);

	return children(adapter);
};
