import Link from 'next/link';

import {Button} from '../common/Button';

import type {ReactElement} from 'react';

export function Form(): ReactElement {
	return (
		<div
			className={'flex max-w-6xl flex-col items-center pt-[160px]'}
			id={'form'}>
			<p className={'text-left font-aeonikFono text-3xl font-light text-white md:text-center md:text-5xl'}>
				{'SUBMIT YOUR APP OR INTEGRATION'}
			</p>
			<Link
				href={'https://forms.gle/S8rL8ZviGsaxZ1LYA'}
				className={'mt-10 w-full  max-w-[480px]'}
				target={'_blank'}>
				<Button className={'mt-6 w-full'}>{'SUBMIT YOUR APP'}</Button>
			</Link>
		</div>
	);
}
