import React from 'react';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {yDaemonGaugeRewardsFeedSchema} from '@common/schemas';
import {GaugeListEmpty} from '@yBribe/components/bribe/GaugeListEmpty';
import {RewardFeedTableRow} from '@yBribe/components/rewardFeed/RewardFeedTableRow';

import type {ReactElement, ReactNode} from 'react';

export function RewardFeedTable(): ReactElement | null {
	const {settings: baseAPISettings} = useSettings();
	const {data} = useSWR(
		`${baseAPISettings.yDaemonBaseURI}/1/bribes/newRewardFeed`,
		baseFetcher
	);

	if (!data) {
		return null;
	}

	const result = yDaemonGaugeRewardsFeedSchema.safeParse(data);

	if (!result.success) {
		// TODO Send to Sentry
		console.error(result?.error);
		return <GaugeListEmpty />;
	}

	const sortedFeed = result.data.sort((a, b): number => b.timestamp - a.timestamp) ;

	return (
		<>
			{sortedFeed.filter(Boolean).map((item, index): ReactNode =>
				<RewardFeedTableRow
					key={`${index}-${item.txHash}_${item.briber}_${item.rewardToken}`}
					currentRewardAdded={item} />
			)}
		</>
	);
}

