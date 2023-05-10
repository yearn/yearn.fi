import type {TYDaemonReports} from '@vaults/schemas';

export type TYDaemonPartialReports = Pick<TYDaemonReports, 'timestamp'> & {
	results: Pick<TYDaemonReports['results'][0], 'APR'>[];
};

export function findLatestApr(reports?: TYDaemonPartialReports[]): number {
	if (!reports?.length) {
		return 0;
	}

	const latestReport = reports.reduce(
		(prev, curr): TYDaemonPartialReports => {
			return parseInt(prev.timestamp) > parseInt(curr.timestamp)
				? prev
				: curr;
		}
	);

	const apr = Number(latestReport.results[0]?.APR);
    
	return isNaN(apr) ? 0 : apr * 100;
}
