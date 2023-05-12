import type {TYDaemonReports} from '@vaults/schemas';

export function findLatestApr(reports: TYDaemonReports[]): number {
	if (!reports.length) {
		return 0;
	}

	const latestReport = reports.reduce((prev, curr): TYDaemonReports => {
		return prev.timestamp > curr.timestamp ? prev : curr;
	});

	return latestReport.results[0].APR * 100;
}
