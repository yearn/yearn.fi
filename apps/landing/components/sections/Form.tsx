import {Button} from '../common/Button';

import type {ReactElement} from 'react';

export function Form(): ReactElement {
	return (
		<div
			className={'flex max-w-6xl flex-col items-center pt-[160px]'}
			id={'form'}>
			<p className={'text-left font-aeonikFono text-3xl font-light text-white md:text-center md:text-5xl'}>
				{'SUBMIT YOUR APP IDEA OR INTEGRATION'}
			</p>
			<form className={'mt-10 flex w-full max-w-[480px] flex-col gap-4'}>
				<input
					className={'h-[56px] rounded-lg border bg-transparent px-4'}
					type={'text'}
					placeholder={'Name'}
					name={'name'}
				/>
				<input
					className={'h-[56px] rounded-lg border bg-transparent px-4'}
					type={'text'}
					placeholder={'TG tag'}
					name={'tgTag'}
				/>
				<input
					className={'h-[56px] rounded-lg border bg-transparent px-4'}
					type={'text'}
					placeholder={'Project name'}
					name={'projectName'}
				/>
				<textarea
					className={'h-[152px] resize-none rounded-lg border bg-transparent px-4'}
					placeholder={'Description'}
					name={'description'}
				/>
				<Button className={'mt-6'}>{'SUBMIT'}</Button>
			</form>
		</div>
	);
}
