import React, {ReactElement} from 'react';
import {Button} from '@yearn-finance/web-lib/components';
import {useClientEffect} from '@yearn-finance/web-lib/hooks';
import CardMigrateLegacy from 'components/apps/ycrv/swagRock/CardMigrateLegacy';
import CardZap from 'components/apps/ycrv/swagRock/CardZap';
import Wrapper from 'components/apps/ycrv/Wrapper';

function	TextAnimation(): ReactElement {
	function	onStartAnimation(): void {
		const words = document.getElementsByClassName('word') as any;
		const wordArray: any[] = [];
		let currentWord = 0;

		words[currentWord].style.opacity = 1;
		for (const word of words) {
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
					nw[0].parentElement.style.opacity = 1;
				}
				animateLetterIn(nw, i);
			}
			currentWord = (currentWord == wordArray.length-1) ? 0 : currentWord+1;
		}

		function animateLetterOut(cw: any, i: number): void {
			setTimeout((): void => {
				cw[i].className = 'letter out';
			}, i*80);
		}

		function animateLetterIn(nw: any, i: number): void {
			setTimeout((): void => {
				nw[i].className = 'letter in';
			}, 340+(i*80));
		}

		function splitLetters(word: any): void {
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
		onStartAnimation();
	}, []);

	return (
		<>
			<div className={'text'}>
				<p className={'wordWrapper'}> 
					<span className={'word'}>{'Gigantic'}</span>
					<span className={'word'}>{'Seismic'}</span>
					<span className={'word'}>{'Substantial'}</span>
					<span className={'word'}>{'Immense'}</span>
					<span className={'word'}>{'Colossal'}</span>
					<span className={'word'}>{'Humongous'}</span>
					<span className={'word'}>{'Giant'}</span>
					<span className={'word'}>{'Stupendous'}</span>
					<span className={'word'}>{'Jumbo'}</span>
				</p>
			</div>
		</>
	);
}

function	Index(): ReactElement {
	return (
		<>
			<div className={'mx-auto mt-20 mb-44 flex w-full max-w-6xl flex-col items-center justify-center'}>
				<div className={'relative h-12 w-[300px] md:h-[104px] md:w-[600px]'}>
					<TextAnimation />
				</div>
				<div className={'mt-8 mb-6'}>
					<p className={'text-center text-lg md:text-2xl'}>{'Whatever word you choose, get supercharged yields on CRV with Yearn.'}</p>
				</div>
				<div>
					<Button
						as={'a'}
						href={'#swap'}
						className={'w-full'}>
						{'To the yield!'}
					</Button>
				</div>
			</div>
			<section id={'swap'} className={'mt-0 flex w-full flex-col items-center justify-center space-y-10 space-x-0 md:flex-row md:space-y-0 md:space-x-4 lg:space-x-0'}>
				<CardMigrateLegacy />
				<CardZap />
			</section>
		</>
	);
}

Index.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default Index;