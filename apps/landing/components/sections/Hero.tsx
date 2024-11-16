import Image from 'next/image';
import {scrollToHash} from 'apps/landing/utils/scrollToHash';
import {motion} from 'framer-motion';

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
						'relative mx-6 mt-6 flex h-[568px] w-[2365px] max-w-[2352px] flex-col items-center self-center rounded-lg border border-[#292929]'
					}>
					<AnimatedLogos />
					<div className={'z-20 mt-[88px] text-center'}>
						<p className={'text-[80px] font-bold leading-[80px] text-white'}>{'THE DEFI WAY'}</p>
						<p className={'text-[80px] font-bold leading-[80px] text-white'}>{'TO EARN ON CRYPTO'}</p>
						<p className={'mt-4 text-grey-400'}>
							{'Yearn is DeFi’s longest running, most battle tested, and most trusted yield protocol.'}
						</p>
					</div>
					<div className={'mt-[72px] flex gap-2'}>
						<Button className={'w-[192px] px-[15px]'}>{'DISCOVER PRODUCTS'}</Button>
						<Button
							onClick={() => scrollToHash('form')}
							variant={'secondary'}
							className={'w-[192px]'}>
							{'SUBMIT YOUR APP'}
						</Button>
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
					width={277}
					height={277}
				/>
				<div className={'z-20 mt-4 text-center'}>
					<p className={'text-center text-[40px] font-bold leading-[48px] text-white'}>
						{'THE DEFI WAY TO EARN ON CRYPTO'}
					</p>
					<p className={'mt-4 text-grey-400'}>
						{'Yearn is DeFi’s longest running, most battle tested, and most trusted yield protocol.'}
					</p>
				</div>
				<div className={'mt-10 flex w-full flex-col gap-2'}>
					<Button className={'px-[15px]'}>{'DISCOVER PRODUCTS'}</Button>
					<Button
						variant={'secondary'}
						onClick={() => scrollToHash('form')}>
						{'SUBMIT YOUR APP'}
					</Button>
				</div>
			</div>
		</>
	);
}
