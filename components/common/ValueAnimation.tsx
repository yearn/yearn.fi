/* eslint-disable no-irregular-whitespace */
import React, {ReactElement, useRef} from 'react';
import {useClientEffect} from '@yearn-finance/web-lib/hooks';

function	ValueAnimation({
	identifier,
	value,
	defaultValue = '0.00',
	prefix = '',
	suffix = '',
	className = 'wordLeft'
}: {
	identifier: string;
	value: string | undefined,
	defaultValue?: string,
	prefix?: string,
	suffix?: string,
	className?: string
}): ReactElement {
	const	hasBeenTriggerd = useRef<boolean>(false);

	function	initZero(): void {
		const words = document.getElementsByClassName(identifier) as any;
		words[0].style.opacity = 1;
	}

	function	onStartAnimation(): void {
		hasBeenTriggerd.current = true;
		const words = document.getElementsByClassName(identifier) as any;
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

		setTimeout((): void => changeWord(), 100);
	}

	useClientEffect((): void => {
		initZero();
	}, []);
	useClientEffect((): void => {
		if (value && !hasBeenTriggerd.current) {
			onStartAnimation();
		}
	}, [value, hasBeenTriggerd.current]);

	return (
		<>
			<div className={'text'}>
				<p className={'wordWrapper'}> 
					<span className={`${className} ${identifier}`}>{`${prefix ? `${prefix} ` : ''}${defaultValue}${suffix ? ` ${suffix}` : ''}`}</span>
					<span className={`${className} ${identifier}`}>{`${prefix ? `${prefix} ` : ''}${value}${suffix ? ` ${suffix}` : ''}`}</span>
				</p>
			</div>
		</>
	);
}

export default ValueAnimation;