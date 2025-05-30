import {isZero} from '@builtbymom/web3/utils';

import type {TYDaemonReport, TYDaemonReports} from '@vaults/schemas/reportsSchema';

export function findLatestAPY(reports?: TYDaemonReports): number {
	if (!reports?.length) {
		return 0;
	}

	const latestReport = reports.reduce((prev, curr): TYDaemonReport => {
		return prev.timestamp > curr.timestamp ? prev : curr;
	});

	if (!latestReport.results || isZero(latestReport.results.length)) {
		return 0;
	}

	return latestReport.results[0].APR;
}
