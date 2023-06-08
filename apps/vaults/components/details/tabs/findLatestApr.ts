import {isZero} from '@yearn-finance/web-lib/utils/isZero';

import type {TYDaemonReport, TYDaemonReports} from '@vaults/schemas/reportsSchema';

export function findLatestApr(reports?: TYDaemonReports): number {
	if (!reports?.length) {
		return 0;
	}

	const latestReport = reports.reduce((prev, curr): TYDaemonReport => {
		return prev.timestamp > curr.timestamp ? prev : curr;
	});

	if (!latestReport.results || isZero(latestReport.results.length)) {
		return 0;
	}

	return latestReport.results[0].APR * 100;
}
