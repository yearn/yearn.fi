import {type ReactElement, useEffect, useRef} from 'react';
import {useRouter} from 'next/navigation';
import {useMountEffect} from '@react-hookz/web';
import {AppsCarousel} from '@common/components/AppsCarousel';
import {CategorySection} from '@common/components/CategorySection';
import {Cutaway} from '@common/components/Cutaway';
import {useSearch} from '@common/contexts/useSearch';
import {LogoDiscord} from '@common/icons/LogoDiscord';
import {LogoTwitter} from '@common/icons/LogoTwitter';
import {COMMUNITY_APPS, FEATURED_APPS, YEARN_X_APPS} from '@common/utils/constants';

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
			<div className={'text sticky flex justify-start text-white'}>
				<p className={'text-left'}>
					<span className={'word flex w-full justify-start text-white md:text-[100px]'}>{'STAKE'}</span>
					<span className={'word flex w-full justify-start text-white md:text-[100px]'}>{'INVEST'}</span>
					<span className={'word flex w-full justify-start text-white md:text-[100px]'}>{'BUILD'}</span>
					<span className={'word flex w-full justify-start text-white md:text-[100px]'}>{'CHILL'}</span>
					<span className={'word flex w-full justify-start text-white md:text-[100px]'}>{'LOCK'}</span>
					<span className={'word flex w-full justify-start text-white md:text-[100px]'}>{'EARN'}</span>
					<span className={'word flex w-full justify-start text-white md:text-[100px]'}>{'APE'}</span>
				</p>
			</div>
		</>
	);
}

export default function Home(): ReactElement {
	const router = useRouter();
	const {dispatch} = useSearch();

	useMountEffect(() => {
		dispatch({type: 'SET_SEARCH', payload: ''});
	});

	return (
		<div className={'mb-4 mt-20 flex w-full justify-center'}>
			<div className={'w-full p-6 md:max-w-6xl md:p-0 md:pl-28 lg:pl-36'}>
				<div className={'flex flex-col gap-y-6'}>
					<div
						className={
							'flex w-full justify-start text-[48px] font-bold uppercase leading-[56px] text-white md:text-[100px] md:leading-[108px]'
						}>
						<TextAnimation />
						<br /> {'with yearn'}
					</div>

					<div className={'max-w-[610px]'}>
						<p className={'text-base text-gray-400'}>
							{
								'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.'
							}
						</p>
					</div>

					<div>
						<h1 className={'mb-6 text-lg text-white'}>{'Featured Apps'}</h1>
						<AppsCarousel apps={FEATURED_APPS} />
					</div>

					<div className={'flex flex-col gap-[64px]'}>
						<CategorySection
							title={'Community Apps'}
							onExpandClick={() => router.push('/home/community')}
							apps={COMMUNITY_APPS}
						/>

						<CategorySection
							title={'Yearn X Projects'}
							onExpandClick={() => router.push('/home/yearn-x')}
							apps={YEARN_X_APPS}
						/>
					</div>
				</div>
				<div className={'mt-[120px] flex w-full flex-col gap-6 md:flex-row'}>
					<Cutaway
						title={'Follow us on X'}
						description={'Product description example text product description example text'}
						icon={<LogoTwitter className={'text-white'} />}
						link={'https://yearn.finance/twitter'}
					/>
					<Cutaway
						title={'Join our Discord'}
						description={'Product description example text product description example text'}
						icon={<LogoDiscord className={'text-white'} />}
						link={'https://discord.com/invite/yearn'}
					/>
				</div>
			</div>
		</div>
	);
}
