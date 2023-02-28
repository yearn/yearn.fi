import type {ReactElement} from 'react';

type TAmountInputProps = {
	amount: string | number;
	maxAmount?: string | number;
	maxLabel?: string;
	label?: string;
	placeholder?: string;
	legend?: string;
	error?: string;
	disabled?: boolean;
	loading?: boolean;
	onAmountChange?: (amount: string) => void;
	onLegendClick?: () => void;
	onMaxClick?: () => void;
}

function AmountInput({
	amount,
	maxAmount,
	label,
	placeholder,
	legend,
	error,
	disabled,
	loading,
	onAmountChange,
	onLegendClick,
	onMaxClick
}: TAmountInputProps): ReactElement {
	let displayedAmount = amount.toString();
	if(displayedAmount === '0' && !disabled) {
		displayedAmount = '';
	}
	if(displayedAmount === '0.0' && disabled) {
		displayedAmount = '0';
	}
	return (
		<div className={'w-full'}>
			{label && (
				<p
					className={'mb-1 w-full overflow-hidden text-ellipsis whitespace-nowrap text-base text-neutral-600'}>
					{label}
				</p>
			)}
			<div className={'relative flex w-full items-center justify-center'}>
				<input
					className={`h-10 w-full p-2 font-mono text-base font-normal outline-none ${maxAmount && !disabled ? 'pr-12' : null} ${error ? 'border border-solid border-[#EA5204] focus:border-[#EA5204]' : 'border-0 border-none'} ${disabled ? 'bg-neutral-300 text-neutral-600' : 'bg-neutral-0'}`}
					type={'number'}
					min={0}
					aria-label={label}
					value={displayedAmount}
					onChange={onAmountChange ? (e): void => onAmountChange(e.target.value) : undefined}
					placeholder={loading ? '' : placeholder ?? '0'}
					disabled={disabled}
				/>
				{maxAmount && !disabled ? (
					<button
						onClick={onMaxClick ? (): void => onMaxClick() : undefined}
						className={'absolute right-2 ml-2 h-6 cursor-pointer border-none bg-neutral-900 px-2 py-1 text-xs text-neutral-0 transition-colors hover:bg-neutral-700'}>
						{'Max'}
					</button>
				) : null}
			</div>
			{(error || legend) && (
				<legend
					role={onLegendClick ? 'button' : 'text'}
					onClick={onLegendClick}
					className={`mt-1 pl-2 text-xs md:mr-0 ${error ? 'text-[#EA5204]' : 'text-neutral-600'}`}
					suppressHydrationWarning>
					{error ?? legend}
				</legend>
			)}
		</div>
	);
}

export {AmountInput};
