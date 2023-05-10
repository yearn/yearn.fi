import type {TYDaemonReports} from '@vaults/schemas';

export function findLatestApr(reports?: TYDaemonReports[]): number {
	if (!reports?.length) {
		return 0;
	}

	const latestReport = reports.reduce((prev, curr): TYDaemonReports => {
		return parseInt(prev.timestamp) > parseInt(curr.timestamp)
			? prev
			: curr;
	});

	const apr = Number(latestReport.results[0]?.APR);

	return isNaN(apr) ? 0 : apr * 100;
}
