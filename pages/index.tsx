import React, {useRef} from 'react';
import Balancer from 'react-wrap-balancer';
import Image from 'next/image';
import Link from 'next/link';
import {useClientEffect} from '@yearn-finance/web-lib/hooks/useClientEffect';
import {YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import LogoYearn from '@common/icons/LogoYearn';

import type {ReactElement} from 'react';

const	apps = [
	{
		href: '/vaults',
		title: 'Vaults',
		description: 'deposit tokens and receive yield.',
		icon: <LogoYearn
			className={'h-[100px] w-[100px]'}
			back={'text-pink-400'}
			front={'text-white'} />
	}, {
		href: '/ycrv',
		title: 'yCRV',
		description: 'get the best CRV yields in DeFi.',
		icon: <Image
			alt={'yCRV'}
			width={100}
			height={100}
			src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
			loading={'eager'}
			priority />
	}, {
		href: '/veyfi',
		title: 'veYFI',
		description: 'lock YFI\nto take part in governance.',
		icon: <LogoYearn
			className={'h-[100px] w-[100px]'}
			back={'text-primary'}
			front={'text-white'} />
	}, {
		href: '/ybribe',
		title: 'yBribe',
		description: 'sell votes, or buy them.\njust like democracy.',
		icon: <LogoYearn
			className={'h-[100px] w-[100px]'}
			back={'text-neutral-900'}
			front={'text-neutral-0'} />
	}
];

function	AppBox({app}: {app: typeof apps[0]}): ReactElement {
	useClientEffect((): VoidFunction => {
		const featuresEl = document.getElementById(app.href);
		if (featuresEl) {
			const	cleanup = (): void => {
				featuresEl.removeEventListener('pointermove', pointermove);
				featuresEl.removeEventListener('pointerleave', pointerleave);
			};

			const	pointermove = (ev: MouseEvent): void => {
				const rect = featuresEl.getBoundingClientRect();
				if (featuresEl?.style) {
					featuresEl.style.setProperty('--opacity', '0.3');
					featuresEl.style.setProperty('--x', (ev.clientX - rect.left).toString());
					featuresEl.style.setProperty('--y', (ev.clientY - rect.top).toString());
				}
			};

			const	pointerleave = (): void => {
				if (featuresEl?.style) {
					featuresEl.style.setProperty('--opacity', '0');
				}
			};

			featuresEl.addEventListener('pointermove', pointermove);
			featuresEl.addEventListener('pointerleave', pointerleave);
			return cleanup;
		}
		return (): void => undefined;
	}, []);

	return (
		<Link
			prefetch={false}
			key={app.href}
			href={app.href}>
			<div id={app.href} className={'appBox'}>
				<div>
					{app.icon}
				</div>
				<div className={'pt-6 text-center'}>
					<b className={'text-lg'}>{app.title}</b>
					<p><Balancer>{app.description}</Balancer></p>
				</div>
			</div>
		</Link>
	);
}

function	TextAnimation(): ReactElement {
	const hasBeenTriggerd = useRef<boolean>(false);

	function	onStartAnimation(): void {
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
			const nw = currentWord == words.length-1 ? wordArray[0] : wordArray[currentWord+1];
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
			currentWord = (currentWord == wordArray.length-1) ? 0 : currentWord+1;
		}

		function animateLetterOut(cw: HTMLSpanElement[], i: number): void {
			setTimeout((): void => {
				cw[i].className = 'letter out';
			}, i*80);
		}

		function animateLetterIn(nw: HTMLSpanElement[], i: number): void {
			setTimeout((): void => {
				nw[i].className = 'letter in';
			}, 340+(i*80));
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

	useClientEffect((): void => {
		if (!hasBeenTriggerd.current) {
			onStartAnimation();
		}
	}, [hasBeenTriggerd.current]);

	return (
		<>
			<div className={'text'}>
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

function	Index(): ReactElement {
	return (
		<>
			<div className={'mx-auto mt-6 mb-10 flex flex-col justify-center md:mt-20 md:mb-14'}>
				<div className={'relative h-12 w-[300px] self-center md:h-[104px] md:w-[600px]'}>
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
						<Balancer>{'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols\nearn yield on their digital assets.'}</Balancer>
					</p>
				</div>
			</div>
			<section className={'grid grid-cols-1 gap-10 md:grid-cols-3 lg:grid-cols-4'}>
				{apps.map((app): ReactElement => <AppBox key={app.href} app={app} />)}
			</section>
		</>
	);
}

export default Index;
