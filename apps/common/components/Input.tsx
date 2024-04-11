import {cl} from '@builtbymom/web3/utils';

import type {ReactElement, ReactNode} from 'react';

type TAmountInputProps = {
	value: string;
	onChange?: (value: string) => void;
	label?: string;
	placeholder?: string;
	legend?: string | ReactNode;
	error?: string;
	isDisabled?: boolean;
	isLoading?: boolean;
	className?: string;
};

export function Input(props: TAmountInputProps): ReactElement {
	const {value, onChange, label, placeholder, legend, error, isDisabled, isLoading, className = ''} = props;
	return (
		<div className={`w-full ${className}`}>
			{label && <p className={'mb-1 w-full truncate text-base text-neutral-600'}>{label}</p>}
			<div className={'relative flex w-full items-center justify-center'}>
				<input
					className={`h-10 w-full p-2 font-mono text-base font-normal outline-none ${
						error ? 'border border-solid border-[#EA5204] focus:border-[#EA5204]' : 'border-0 border-none'
					} ${isDisabled ? 'bg-neutral-300 text-neutral-600' : 'bg-neutral-0'}`}
					type={'text'}
					min={0}
					aria-label={label}
					value={value}
					onChange={onChange ? (e): void => onChange(e.target.value) : undefined}
					placeholder={isLoading ? undefined : placeholder}
					disabled={isDisabled}
				/>
			</div>
			{(error ?? legend) && (
				<legend
					className={`mt-1 pl-0.5 text-xs opacity-70 md:mr-0 ${error ? 'text-[#EA5204]' : 'text-neutral-600'}`}
					suppressHydrationWarning>
					{error ?? legend}
				</legend>
			)}
		</div>
	);
}

export function FakeInput(
	props: Omit<TAmountInputProps, 'value' | 'placeholder' | 'onChange' | 'isDisabled' | 'error'> & {value: ReactNode}
): ReactElement {
	const {value, label, legend, className = ''} = props;
	return (
		<div className={`w-full ${className}`}>
			{label && <p className={'mb-1 w-full truncate text-base text-neutral-600'}>{label}</p>}
			<div className={'relative flex w-full items-center justify-center'}>
				<div
					className={cl(
						`h-10 w-full border-0 border-none bg-neutral-300 p-2 font-mono text-base font-normal outline-none`,
						value === undefined ? 'text-neutral-600/60' : ''
					)}
					aria-label={label}>
					{value || '0.00'}
				</div>
			</div>
			{legend && (
				<legend
					className={`mt-1 pl-0.5 text-xs text-neutral-600 opacity-70 md:mr-0`}
					suppressHydrationWarning>
					{legend}
				</legend>
			)}
		</div>
	);
}
