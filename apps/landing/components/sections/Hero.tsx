import Image from 'next/image';
import Link from 'next/link';
import {motion} from 'framer-motion';
import {TvlStat} from '@common/components/TvlStat';
import {Button} from '../common/Button';
import type {ReactElement} from 'react';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

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
	// Restore: once I've stopped dev-ing
	// const {data: tvl} = useFetch<number>({
	// 	endpoint: `https://api.llama.fi/tvl/yearn`,
	// 	schema: z.number()
	// });
	const tvl = 12310232;

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
						'relative mx-6 mt-6 flex h-[700px] w-[2365px] max-w-[2352px] flex-col items-center self-center rounded-lg border border-[#292929] '
					}>
					<AnimatedLogos />
					<div className="h-[100%] flex items-center justify-center">
						<div className={'z-20 flex flex-col items-center justify-center gap-12 text-center'}>
							<TvlStat tvl={tvl ?? 0} />
							<SectionHeader
								isH1
								title="Earn on your Crypto"
								description="DeFi's longest running, most battle tested protocol"
							/>
							<Link href={'/apps'}>
								<Button>{'Explore Vaults'}</Button>
							</Link>
						</div>
					</div>
				</div>
			</div>
			<div
				className={'flex w-full flex-col items-center px-4 py-8 md:hidden bg-white/25'}
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

					<motion.div
						initial={{opacity: 0, y: 20}}
						animate={{opacity: 1, y: 0}}
						transition={{duration: 0.6, delay: 0.2}}
						className={'mb-8'}>
						<Image
							src={'/landing/yfi-top-right.png'}
							alt={'Yearn Finance Logo'}
							width={180}
							height={180}
							className={'h-auto w-auto max-w-[180px] sm:max-w-[200px]'}
							priority
						/>
					</motion.div>

					<motion.div
						initial={{opacity: 0, y: 20}}
						animate={{opacity: 1, y: 0}}
						transition={{duration: 0.6, delay: 0.4}}
						className={'mb-10'}>
						<SectionHeader
							isH1
							title="Earn on your Crypto"
							description="DeFi's longest running, most battle tested protocol"
						/>
					</motion.div>

					<motion.div
						initial={{opacity: 0, y: 20}}
						animate={{opacity: 1, y: 0}}
						transition={{duration: 0.6, delay: 0.6}}
						className={'w-full'}>
						<Link
							href={'/apps'}
							className={'block w-full'}>
							<Button className={'w-full max-w-xs'}>{'Explore Vaults'}</Button>
						</Link>
					</motion.div>
				</div>
			</div>
		</>
	);
}
