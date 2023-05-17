import type {ReactElement} from 'react';

type TAmountInputProps = {
	value: string;
	onChange?: (value: string) => void;
	label?: string;
	placeholder?: string;
	legend?: string;
	error?: string;
	isDisabled?: boolean;
	isLoading?: boolean;
	className?: string;
}

function Input(props: TAmountInputProps): ReactElement {
	const {value, onChange, label, placeholder, legend, error, isDisabled, isLoading, className = ''} = props;
	return (
		<div className={`w-full ${className}`}>
			{label && (
				<p
					className={'mb-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-base text-neutral-600'}>
					{label}
				</p>
			)}
			<div className={'relative flex w-full items-center justify-center'}>
				<input
					className={`h-10 w-full p-2 font-mono text-base font-normal outline-none ${error ? 'border border-solid border-[#EA5204] focus:border-[#EA5204]' : 'border-0 border-none'} ${isDisabled ? 'bg-neutral-300 text-neutral-600' : 'bg-neutral-0'}`}
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
				<legend className={`mt-1 pl-2 text-xs md:mr-0 ${error ? 'text-[#EA5204]' : 'text-neutral-600'}`} suppressHydrationWarning>
					{error ?? legend}
				</legend>
			)}
		</div>
	);
}

export {Input};
