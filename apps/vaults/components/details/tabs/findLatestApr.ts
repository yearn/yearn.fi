import type {TYDaemonReport, TYDaemonReports} from '@vaults/schemas/reportsSchema';

export function findLatestApr(reports?: TYDaemonReports): number {
	if (!reports?.length) {
		return 0;
	}

	const latestReport = reports.reduce((prev, curr): TYDaemonReport => {
		return prev.timestamp > curr.timestamp ? prev : curr;
	});

	return latestReport.results[0].APR * 100;
}
