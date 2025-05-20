import Link from 'next/link';

import {Button} from '../common/Button';

import type {ReactElement} from 'react';

export function Form(): ReactElement {
	return (
		<div
			className={'flex max-w-6xl flex-col items-center'}
			id={'form'}>
			<p className={'text-left text-2xl font-medium text-white md:text-center md:text-4xl'}>
				{'Submit your app or integration'}
			</p>
			<Link
				href={'https://forms.gle/S8rL8ZviGsaxZ1LYA'}
				className={'mt-4'}
				target={'_blank'}>
				<Button className={'mt-6 w-full'}>{'Submit Here'}</Button>
			</Link>
		</div>
	);
}
