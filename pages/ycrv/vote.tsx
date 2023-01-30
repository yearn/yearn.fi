import React, {useMemo} from 'react';
import {BigNumber} from 'ethers';
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

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/utils/types';


function Vote(): ReactElement {
	const {isActive} = useWeb3();
	// const {initialData: {nextPeriod, userInfo, getVotesUnpacked}} = useVLyCRV();
	const {initialData: {nextPeriod}} = useVLyCRV();
	const {gauges, isLoadingGauges} = useCurve();

	// Fake it until you make it
	const MOCK_USER_INFO = {
		balance: BigNumber.from('100000000000000000000'),
		votesSpent: BigNumber.from('50000000000000000000'),
		lastVoteTime: 1674217683000
	};

	const MOCK_GET_VOTES_UNPACKED: {
		gaugesList: string[];
		voteAmounts: BigNumber[];
	} = {
		gaugesList: [
			'0xDB190E4d9c9A95fdF066b258892b8D6Bb107434e',
			'0x6a69FfD1353Fa129f7F9932BB68Fa7bE88F3888A',
			'0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1'
		],
		voteAmounts: [
			BigNumber.from('10000000000000000000000'),
			BigNumber.from('2000000000000000000000'),
			BigNumber.from('300000000000000000000')
		]
	};

	const {gaugesList, voteAmounts} = MOCK_GET_VOTES_UNPACKED;
	const gaugesVotes = useMemo((): TDict<BigNumber> => {
		return gaugesList.reduce((prev, curr, i): TDict<BigNumber> => ({...prev, [curr]: voteAmounts[i]}), {});
	}, [gaugesList, voteAmounts]);

	// const {balance, lastVoteTime, votesSpent} = userInfo;
	const {balance, lastVoteTime, votesSpent} = MOCK_USER_INFO;
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
							{lastVoteTime ? formatDateShort(lastVoteTime) : '—'}
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
				userInfo={MOCK_USER_INFO} />
		</>
	);
}

Vote.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Vote;
