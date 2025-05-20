import Image from 'next/image';
import Link from 'next/link';
import {z} from 'zod';
import {motion} from 'framer-motion';
import {useFetch} from '@builtbymom/web3/hooks/useFetch';
import {TvlStat} from '@common/components/TvlStat';

import {Button} from '../common/Button';

import type {ReactElement} from 'react';

function AnimatedLogos(): ReactElement {
	return (
		<>
			<motion.div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-bottom-right.png')",
					backgroundRepeat: 'no-repeat',
					width: '480px',
					height: '160px'
				}}
				animate={{
					y: ['0px', '30px', '0px']
				}}
				transition={{
					duration: 4,
					ease: 'easeInOut',
					repeat: Infinity,
					repeatType: 'loop'
				}}
				initial={{left: '70%', bottom: '0px'}}
			/>
			<motion.div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-top-right.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: '100% 100%',
					width: '240px',
					height: '240px'
				}}
				animate={{
					y: ['0px', '-40px', '0px']
				}}
				transition={{
					duration: 4,
					ease: 'easeInOut',
					repeat: Infinity,
					repeatType: 'loop'
				}}
				initial={{left: '76%', top: '104px'}}
			/>
			<motion.div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-top-left.png')",
					backgroundRepeat: 'no-repeat',
					width: '240px',
					height: '240px'
				}}
				animate={{
					y: ['0px', '-40px', '0px']
				}}
				transition={{
					duration: 4,
					ease: 'easeInOut',
					repeat: Infinity,
					repeatType: 'loop'
				}}
				initial={{right: '70%', top: '32px'}}
			/>
			<motion.div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-left-center.png')",
					backgroundRepeat: 'no-repeat',
					width: '200px',
					height: '290px'
				}}
				animate={{
					y: ['0px', '-50px', '0px']
				}}
				transition={{
					duration: 4,
					ease: 'easeInOut',
					repeat: Infinity,
					repeatType: 'loop'
				}}
				initial={{right: '78%', top: '200px'}}
			/>
			<motion.div
				className={'absolute'}
				style={{
					backgroundImage: "url('/landing/yfi-bottom-left.png')",
					backgroundRepeat: 'no-repeat',
					width: '440px',
					height: '160px'
				}}
				animate={{
					y: ['0px', '20px', '0px']
				}}
				transition={{
					duration: 4,
					ease: 'easeInOut',
					repeat: Infinity,
					repeatType: 'loop'
				}}
				initial={{right: '60%', bottom: '0px'}}
			/>
		</>
	);
}

export function Hero(): ReactElement {
	// TODO: do we have an alt TVL API endpoint?
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
					className={
						'relative mx-6 mt-6 flex h-[500px] w-[2365px] max-w-[2352px] flex-col items-center self-center rounded-lg border border-[#292929]'
					}>
					<AnimatedLogos />
					<div
						className={
							'z-20 mt-[88px] flex flex-col items-center justify-center gap-4 text-center md:mt-[160px]'
						}>
						<TvlStat tvl={tvl ?? 0} />
						<div className={'z-20 flex flex-col items-center justify-center pt-2 text-center'}>
							<p className={'text-[56px] font-medium text-white'}>{'Earn on your Crypto'}</p>
							<p className={'mt-1 text-[20px] text-gray-400'}>
								{"DeFi's longest running, most battle tested protocol"}
							</p>
						</div>
						<div className={'mt-[72px] md:mt-[24px] lg:mt-[24px]'}>
							<Link href={'/apps'}>
								<Button>{'Explore Vaults'}</Button>
							</Link>
						</div>
					</div>
				</div>
			</div>
			<div
				className={'flex w-full flex-col items-center px-8 md:hidden'}
				style={{
					backgroundImage: "url('/landing/hero-background-mobile.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: '100% 100%',
					backgroundPosition: 'center'
				}}>
				<Image
					className={'mt-[88px]'}
					src={'/landing/yfi-top-right.png'}
					alt={'hero'}
					width={250}
					height={250}
				/>
				<div className={'z-20 mt-4 flex flex-col items-center text-center'}>
					<p className={'text-center text-[38px] font-medium leading-[42px] text-white'}>
						{'Earn on your Crypto'}
					</p>
					<p
						className={'mt-4 text-center text-gray-400'}
						style={{maxWidth: '30ch'}}>
						{"DeFi's longest running, most battle tested protocol"}
					</p>
				</div>
				<div className={'mt-10 flex w-full flex-col items-center gap-2'}>
					<Link href={'/apps'}>
						<Button>{'Explore Vaults'}</Button>
					</Link>
				</div>
			</div>
		</>
	);
}
