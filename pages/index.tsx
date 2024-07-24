import {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {SearchBar} from '@common/components/SearchBar';
import {LogoYearn} from '@common/icons/LogoYearn';

import type {ReactElement} from 'react';

const apps = [
	{
		href: '/v3',
		title: 'V3',
		description: 'Deposit tokens and receive great yields.',
		icon: (
			<ImageWithFallback
				alt={'V3'}
				width={80}
				height={80}
				src={'/v3.png'}
				loading={'eager'}
				priority
			/>
		)
	},
	{
		href: 'https://gimme.mom/',
		title: 'GIMME',
		description: 'Yields made simple.',
		icon: (
			<ImageWithFallback
				alt={'gimme'}
				width={80}
				height={80}
				src={'/gimme.png'}
				loading={'eager'}
				priority
			/>
		)
	},
	{
		href: 'https://juiced.yearn.fi',
		title: 'Juiced Vaults',
		description: 'Freshly squeezed and bursting with yield.',
		icon: (
			<ImageWithFallback
				alt={'Juiced'}
				width={80}
				height={80}
				src={'/juiced.png'}
				loading={'eager'}
				priority
			/>
		)
	},
	{
		href: '/vaults',
		title: 'Vaults V2',
		description: 'Deposit tokens and receive yield.',
		icon: (
			<LogoYearn
				className={'size-[80px]'}
				back={'text-pink-400'}
				front={'text-white'}
			/>
		)
	},
	{
		href: 'https://veyfi.yearn.fi',
		title: 'veYFI',
		description: 'Lock YFI\nto take part in governance.',
		icon: (
			<LogoYearn
				className={'size-[80px]'}
				back={'text-primary'}
				front={'text-white'}
			/>
		)
	},
	{
		href: 'https://ycrv.yearn.fi',
		title: 'yCRV',
		description: 'Get the best CRV yields in DeFi.',
		icon: (
			<ImageWithFallback
				alt={'yCRV'}
				width={80}
				height={80}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	},
	{
		href: 'https://yeth.yearn.fi',
		title: 'yETH',
		description: 'Simple, straight forward, risk adjusted liquid staking yield.',
		icon: (
			<ImageWithFallback
				alt={'yETH'}
				width={80}
				height={80}
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
				width={80}
				height={80}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png`}
				loading={'eager'}
				priority
			/>
		)
	}
];
function AppBox({app}: {app: (typeof apps)[0]}): ReactElement {
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
					<p className={'text-neutral-600'}>{app.description}</p>
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
	const [searchValue, set_searchValue] = useState<string>('');

	const filteredApps = useMemo(() => {
		if (!searchValue) {
			return apps;
		}
		return apps.filter((app): boolean => {
			const lowercaseSearch = searchValue.toLowerCase();
			const splitted = `${app.title} ${app.description}`.toLowerCase().split(' ');
			return splitted.some((word): boolean => word.startsWith(lowercaseSearch));
		});
	}, [searchValue]);

	return (
		<div className={'mx-auto size-full max-w-6xl py-20'}>
			<div className={'mx-auto mt-6 flex flex-col justify-center md:mt-20'}>
				<div className={'relative h-12 w-[300px] self-center overflow-hidden md:h-[104px] md:w-[600px]'}>
					<TextAnimation />
				</div>
				<p className={'text-center text-8xl font-bold'}>{'WITH YEARN'}</p>
				<div className={'mx-auto mb-[76px] mt-8'}>
					<p className={'max-w-[600px] text-center text-sm text-neutral-500 md:text-base'}>
						{'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols\n'}
						{'earn yield on their digital assets.'}
					</p>
				</div>

				<div className={'mb-20 flex justify-center'}>
					<SearchBar
						className={'yearn--landing-input !p-0'}
						inputClassName={
							'!border-solid border-0 border-b-2 !px-2 border-transparent !outline-none focus:!border-neutral-900 !transition-all'
						}
						iconClassName={'!right-2'}
						searchValue={searchValue}
						searchPlaceholder={'Search'}
						onSearch={(value): void => {
							set_searchValue(value);
						}}
					/>
				</div>
				{!searchValue && <p className={'mb-6 text-center text-lg font-bold'}>{'Official Apps'}</p>}
			</div>
			{filteredApps.length ? (
				<section className={'grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4'}>
					{filteredApps.map(
						(app): ReactElement => (
							<AppBox
								key={app.href}
								app={app}
							/>
						)
					)}
				</section>
			) : (
				<div className={'mx-auto'}>
					<p className={'text-center text-xl font-bold'}>{`No result for "${searchValue}"`}</p>
					<p className={'text-center text-neutral-400'}>{'Try searching for another term'}</p>
				</div>
			)}
		</div>
	);
}

export default Index;
