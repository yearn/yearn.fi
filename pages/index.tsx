import {useEffect, useRef} from 'react';
import Link from 'next/link';
import {motion} from 'framer-motion';
import {V3Mask} from '@vaults-v3/Mark';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {LogoYearn} from '@common/icons/LogoYearn';

import type {ReactElement} from 'react';

const apps = [
	// {
	// 	href: '/vaults-v3',
	// 	title: 'V3',
	// 	description: 'deposit tokens and receive yield.',
	// 	icon: (
	// 		<LogoYearn
	// 			className={'h-[100px] w-[100px]'}
	// 			back={'text-pink-400'}
	// 			front={'text-white'}
	// 		/>
	// 	)
	// },
	{
		href: '/vaults',
		title: 'Vaults',
		description: 'deposit tokens and receive yield.',
		icon: (
			<LogoYearn
				className={'h-[100px] w-[100px]'}
				back={'text-pink-400'}
				front={'text-white'}
			/>
		)
	},
	{
		href: '/ycrv',
		title: 'yCRV',
		description: 'get the best CRV yields in DeFi.',
		icon: (
			<ImageWithFallback
				alt={'yCRV'}
				width={100}
				height={100}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	// {
	// 	href: '/ybal',
	// 	title: 'yBal',
	// 	description: 'get the best Balancer yields in DeFi.',
	// 	icon: <Image
	// 		alt={'yBal'}
	// 		width={100}
	// 		height={100}
	// 		src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YBAL_TOKEN_ADDRESS}/logo-128.png`}
	// 		loading={'eager'}
	// 		priority />
	// },
	{
		href: '/veyfi',
		title: 'veYFI',
		description: 'lock YFI\nto take part in governance.',
		icon: (
			<LogoYearn
				className={'h-[100px] w-[100px]'}
				back={'text-primary'}
				front={'text-white'}
			/>
		)
	},
	{
		href: '/ybribe',
		title: 'yBribe',
		description: 'sell votes, or buy them.\njust like democracy.',
		icon: (
			<LogoYearn
				className={'h-[100px] w-[100px]'}
				back={'text-neutral-900'}
				front={'text-neutral-0'}
			/>
		)
	},
	{
		href: 'https://yeth.yearn.fi',
		title: 'yETH',
		description: 'simple, straight forward, risk adjusted liquid staking yield.',
		icon: (
			<ImageWithFallback
				alt={'yETH'}
				width={100}
				height={100}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/0x1BED97CBC3c24A4fb5C069C6E311a967386131f7/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	{
		href: 'https://yprisma.yearn.fi',
		title: 'yPrisma',
		description: 'Every rainbow needs a pot of gold.',
		icon: (
			<ImageWithFallback
				alt={'yPrisma'}
				width={100}
				height={100}
				src={'/apps/yprisma.png'}
				loading={'eager'}
				priority
			/>
		)
	}
];
function AnimatedGradientBackgroundForV3(): ReactElement {
	return (
		<motion.div
			transition={{duration: 10, delay: 0, repeat: Infinity, ease: 'linear'}}
			animate={{
				background: [
					`linear-gradient(0deg, #D21162 24.91%, #2C3DA6 99.66%)`,
					`linear-gradient(360deg, #D21162 24.91%, #2C3DA6 99.66%)`
				]
			}}
			className={cl('absolute inset-0', 'pointer-events-none')}
		/>
	);
}
function AppBox({app}: {app: (typeof apps)[0]}): ReactElement {
	if (app.title === 'V3') {
		return (
			<Link
				prefetch={false}
				key={app.href}
				href={app.href}>
				<div
					id={app.href}
					className={
						'relative flex h-full w-full cursor-pointer flex-col items-center overflow-hidden rounded-3xl border border-neutral-300/0 p-6'
					}>
					<div className={'z-10 flex w-full flex-col items-center'}>
						<V3Mask className={'-my-10 w-42'} />
						<div className={'pt-2 text-center'}>
							<p
								className={cl(
									'font-black text-neutral-900 text-lg',
									'whitespace-break-spaces uppercase'
								)}>
								{`Discover brand new vaults`}
							</p>
						</div>
					</div>
					<AnimatedGradientBackgroundForV3 />
				</div>
			</Link>
		);
	}

	return (
		<Link
			key={app.href}
			href={app.href}>
			<div
				id={app.href}
				className={'appBox'}>
				<div>{app.icon}</div>
				<div className={'pt-6 text-center'}>
					<b className={'text-lg'}>{app.title}</b>
					<p>{app.description}</p>
				</div>
			</div>
		</Link>
	);
}

function TextAnimation(): ReactElement {
	const hasBeenTriggerd = useRef<boolean>(false);

	function onStartAnimation(): void {
		hasBeenTriggerd.current = true;
		const words = document.getElementsByClassName('word') as HTMLCollectionOf<HTMLSpanElement>;
		const wordArray: HTMLSpanElement[][] = [];
		let currentWord = 0;

		words[currentWord].style.opacity = '1';
		for (const word of Array.from(words)) {
			splitLetters(word);
		}

		function changeWord(): void {
			const cw = wordArray[currentWord];
			const nw = currentWord == words.length - 1 ? wordArray[0] : wordArray[currentWord + 1];
			if (!cw || !nw) {
				return;
			}
			for (let i = 0; i < cw.length; i++) {
				animateLetterOut(cw, i);
			}

			for (let i = 0; i < nw.length; i++) {
				nw[i].className = 'letter behind';
				if (nw?.[0]?.parentElement?.style) {
					nw[0].parentElement.style.opacity = '1';
				}
				animateLetterIn(nw, i);
			}
			currentWord = currentWord == wordArray.length - 1 ? 0 : currentWord + 1;
		}

		function animateLetterOut(cw: HTMLSpanElement[], i: number): void {
			setTimeout((): void => {
				cw[i].className = 'letter out';
			}, i * 80);
		}

		function animateLetterIn(nw: HTMLSpanElement[], i: number): void {
			setTimeout(
				(): void => {
					nw[i].className = 'letter in';
				},
				340 + i * 80
			);
		}

		function splitLetters(word: HTMLSpanElement): void {
			const content = word.innerHTML;
			word.innerHTML = '';
			const letters = [];
			for (let i = 0; i < content.length; i++) {
				const letter = document.createElement('span');
				letter.className = 'letter';
				letter.innerHTML = content.charAt(i);
				word.appendChild(letter);
				letters.push(letter);
			}

			wordArray.push(letters);
		}

		setTimeout((): void => {
			changeWord();
			setInterval(changeWord, 3000);
		}, 3000);
	}

	useEffect((): void => {
		if (!hasBeenTriggerd.current) {
			onStartAnimation();
		}
	}, []);

	return (
		<>
			<div className={'text sticky'}>
				<p className={'wordWrapper'}>
					<span className={'word'}>{'STAKE'}</span>
					<span className={'word'}>{'INVEST'}</span>
					<span className={'word'}>{'BUILD'}</span>
					<span className={'word'}>{'CHILL'}</span>
					<span className={'word'}>{'LOCK'}</span>
					<span className={'word'}>{'EARN'}</span>
					<span className={'word'}>{'APE'}</span>
				</p>
			</div>
		</>
	);
}

function Index(): ReactElement {
	return (
		<div className={'mx-auto h-full w-full max-w-6xl py-20'}>
			<div className={'mx-auto mb-10 mt-6 flex flex-col justify-center md:mb-14 md:mt-20'}>
				<div className={'relative h-12 w-[300px] self-center overflow-hidden md:h-[104px] md:w-[600px]'}>
					<TextAnimation />
				</div>
				<div className={'my-8'}>
					<p className={'text-center text-lg md:text-2xl'}>
						{'With '}
						<b>{'Yearn'}</b>
						{'. The Yield Protocol.'}
					</p>
				</div>
				<div className={'mb-6'}>
					<p className={'text-center text-sm text-neutral-500 md:text-base'}>
						{'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols\n'}
						{'earn yield on their digital assets.'}
					</p>
				</div>
			</div>
			<section className={'grid grid-cols-1 gap-10 md:grid-cols-3 lg:grid-cols-3'}>
				{apps.map(
					(app): ReactElement => (
						<AppBox
							key={app.href}
							app={app}
						/>
					)
				)}
			</section>
		</div>
	);
}

export default Index;
