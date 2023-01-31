import React, {useMemo} from 'react';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {computeTimeLeft, HeroTimer} from '@common/components/HeroTimer';
import {Tabs} from '@common/components/Tabs';
import {useCurve} from '@common/contexts/useCurve';
import {formatDateShort} from '@common/utils';
import GaugeList from '@yCRV/components/list/GaugeList';
import Deposit from '@yCRV/components/tabs/Deposit.vl-yCRV';
import HowItWorks from '@yCRV/components/tabs/HowItWorks.vl-yCRV';
import Withdraw from '@yCRV/components/tabs/Withdraw.vl-yCRV';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';
import Wrapper from '@yCRV/Wrapper';

import type {BigNumber} from 'ethers';
import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/utils/types';


function Vote(): ReactElement {
	const {isActive} = useWeb3();
	const {initialData: {nextPeriod, userInfo, getVotesUnpacked}} = useVLyCRV();
	const {gauges, isLoadingGauges} = useCurve();
	const {gaugesList, voteAmounts} = getVotesUnpacked;
	const gaugesVotes = useMemo((): TDict<BigNumber> => {
		return gaugesList.reduce((prev, curr, i): TDict<BigNumber> => ({...prev, [curr]: voteAmounts[i]}), {});
	}, [gaugesList, voteAmounts]);

	const {balance, lastVoteTime, votesSpent} = userInfo;
	const totalVotes = formatToNormalizedValue(balance);
	const remainingVotesForThisPeriod = formatToNormalizedValue(balance.sub(votesSpent));

	const ONE_DAY_MS = 24 * 60 * 60 * 1000;
	const timeLeft = computeTimeLeft({endTime: nextPeriod});
	const isLessThan1Day = isActive && !!nextPeriod && timeLeft < ONE_DAY_MS;

	return (
		<>
			<HeroTimer endTime={nextPeriod} />
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<div className={'mb-10 md:mb-14'}>
					{isLessThan1Day && !!timeLeft ?
						<p className={'text-2xl font-bold text-[#8F0000]'}>{'Last day to vote!'}</p>
						:
						<b className={'text-center text-lg md:text-2xl'}>{'Time left till next period'}</b>
					}
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-12'}>
					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{totalVotes}
						</b>
						<legend className={'text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
							{'Your total votes'}
						</legend>
					</div>

					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{remainingVotesForThisPeriod}
						</b>
						<legend className={'text-xxs text-neutral-600 md:text-xs'}>{'Your remaining votes'}</legend>
					</div>

					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{lastVoteTime ? formatDateShort(lastVoteTime * 1000) : '—'}
						</b>
						<legend className={'text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
							{'Your last vote'}
						</legend>
					</div>
				</div>
			</div>
			<div className={'mb-10'}>
				<Tabs
					items={[
						{id: 'deposit', label: 'Deposit', content: <Deposit />},
						{id: 'withdraw', label: 'Withdraw', content: <Withdraw />},
						{id: 'how-it-works', label: 'How it works', content: <HowItWorks />}
					]} />
			</div>
			<GaugeList
				gauges={gauges}
				gaugesVotes={gaugesVotes}
				isLoading={isLoadingGauges}
				userInfo={userInfo} />
		</>
	);
}

Vote.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Vote;
