import Image from 'next/image';
import Link from 'next/link';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';
import {z} from 'zod';
import {useFetch} from '@builtbymom/web3/hooks/useFetch';
import {TvlStat} from '@common/components/TvlStat';

import {Button} from '../common/Button';

import type {ReactElement} from 'react';

function AnimatedLogos(): ReactElement {
	return (
		<>
			<div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-bottom-right.png')",
					backgroundRepeat: 'no-repeat',
					width: '480px',
					height: '160px',
					left: '70%',
					bottom: '0px'
				}}
			/>
			<div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-top-right.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: '100% 100%',
					width: '240px',
					height: '240px',
					left: '76%',
					top: '104px'
				}}
			/>
			<div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-top-left.png')",
					backgroundRepeat: 'no-repeat',
					width: '240px',
					height: '240px',
					right: '70%',
					top: '32px'
				}}
			/>
			<div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-left-center.png')",
					backgroundRepeat: 'no-repeat',
					width: '200px',
					height: '290px',
					right: '78%',
					top: '200px'
				}}
			/>
			<div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-bottom-left.png')",
					backgroundRepeat: 'no-repeat',
					width: '440px',
					height: '160px',
					right: '60%',
					bottom: '0px'
				}}
			/>
		</>
	);
}

export function Hero(): ReactElement {
	const {data: tvl} = useFetch<number>({
		endpoint: `https://api.llama.fi/tvl/yearn`,
		schema: z.number()
	});

	return (
		<>
			<div className={'hidden w-full justify-center overflow-hidden md:flex'}>
				<div
					style={{
						backgroundImage: "url('/landing/hero-background.png')",
						backgroundRepeat: 'no-repeat',
						backgroundSize: '100% 100%',
						backgroundPosition: 'center',
						overflow: 'hidden'
					}}
					className={'relative flex h-[600px] w-[2365px] max-w-[2352px] flex-col items-center self-center'}>
					<AnimatedLogos />
					<div className={'flex h-full items-center justify-center'}>
						<div className={'z-20 flex flex-col items-center justify-center gap-12 text-center'}>
							<div className={'mb-8 mt-12'}>
								<TvlStat tvl={tvl ?? 0} />
							</div>
							<SectionHeader
								isH1
								align={'center'}
								title={'Earn on your Crypto'}
								description={"DeFi's longest running, most battle tested protocol"}
							/>
							<Link href={'/apps'}>
								<Button className={'md:text-[18px]'}>{'Explore Vaults'}</Button>
							</Link>
						</div>
					</div>
				</div>
			</div>
			<div
				className={'flex w-full flex-col items-center bg-white/25 px-4 py-8 md:hidden'}
				style={{
					backgroundImage: "url('/landing/hero-background-mobile.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: '100% 100%',
					backgroundPosition: 'center'
				}}>
				<div className={'flex w-full max-w-sm flex-col items-center text-center'}>
					<div className={'mb-8 mt-12'}>
						<TvlStat tvl={tvl ?? 0} />
					</div>

					<div className={'mb-8'}>
						<Image
							src={'/landing/yfi-top-right.png'}
							alt={'Yearn Finance Logo'}
							width={180}
							height={180}
							className={'size-auto max-w-[180px] sm:max-w-[200px]'}
							priority
						/>
					</div>

					<div className={'mb-10'}>
						<SectionHeader
							isH1
							align={'center'}
							title={'Earn on your Crypto'}
							description={"DeFi's longest running, most battle tested protocol"}
						/>
					</div>

					<div className={'w-full'}>
						<Link
							href={'/apps'}
							className={'block w-full'}>
							<Button className={'max-w-xs'}>{'Explore Vaults'}</Button>
						</Link>
					</div>
				</div>
			</div>
		</>
	);
}
