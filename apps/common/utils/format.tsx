import {type ReactElement, useMemo} from 'react';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';

type TAmountOptions = {
	minimumFractionDigits?: number,
	maximumFractionDigits?: number,
	displayDigits?: number,
	shouldDisplaySymbol?: boolean
	shouldCompactValue?: boolean
}
type TAmount = {
	value: bigint | number
	decimals: number | bigint
	symbol?: string
	options?: TAmountOptions
}
const defaultOptions: TAmountOptions = {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	displayDigits: 0,
	shouldDisplaySymbol: true,
	shouldCompactValue: true
};
function assertValidNumber(value: number | undefined, defaultValue: number, label: string): number {
	if (value === undefined) {
		return defaultValue;
	}
	if (value < 0) {
		console.warn(`formatAmount: ${label} should be positive.`);
		return (defaultValue);
	}
	if (value > 18) {
		console.warn(`formatAmount: ${label} should be less than 18.`);
		return (18);
	}
	if (Number.isNaN(value)) {
		console.warn(`formatAmount: ${label} is NaN.`);
		return (defaultValue);
	}
	if (!Number.isSafeInteger(value)) {
		console.warn(`formatAmount: ${label} should be an integer.`);
		return (defaultValue);
	}
	return value;
}
function assignOptions(options?: TAmountOptions): TAmountOptions {
	if (!options) {
		return defaultOptions;
	}

	/* 🔵 - Yearn Finance *************************************************************************
	** We need to ensure that displayDigits is a valid number. It can be any positive integer
	** between 0 and 18. If the value is invalid, we display a warning and set the value to the
	** default value (0 or 18).
	**********************************************************************************************/
	options.displayDigits = assertValidNumber(options?.displayDigits, 0, 'displayDigits');

	/* 🔵 - Yearn Finance *************************************************************************
	** We need to ensure that minimumFractionDigits is a valid number. It can be any positive
	** integer between 0 and 18. If the value is invalid, we display a warning and set the value to
	** the default value (2 or 18).
	**********************************************************************************************/
	options.minimumFractionDigits = assertValidNumber(options?.minimumFractionDigits, 2, 'minimumFractionDigits');

	/* 🔵 - Yearn Finance *************************************************************************
	** We need to ensure that maximumFractionDigits is a valid number. It can be any positive
	** integer between 0 and 18. If the value is invalid, we display a warning and set the value to
	** the default value (2 or 18).
	**********************************************************************************************/
	options.maximumFractionDigits = assertValidNumber(options?.maximumFractionDigits, 2, 'maximumFractionDigits');

	/* 🔵 - Yearn Finance *************************************************************************
	** We need to ensure that maximumFractionDigits is always bigger or equal to
	** minimumFractionDigits, otherwise we set them as equal.
	**********************************************************************************************/
	if (options.maximumFractionDigits < options.minimumFractionDigits) {
		options.maximumFractionDigits = options.minimumFractionDigits;
	}

	if (options.shouldDisplaySymbol === undefined) {
		options.shouldDisplaySymbol = true;
	}
	if (options.shouldCompactValue === undefined) {
		options.shouldCompactValue = true;
	}

	return options;
}
function formatLocalAmount(
	amount: number,
	decimals: number,
	symbol: string,
	options: TAmountOptions
): string {
	/* 🔵 - Yearn Finance *************************************************************************
	** Define the normalized elements.
	** We use a few tricks here to get the benefits of the intl package and correct formating no
	** matter the provided local.
	** - Fallback formatting is set to `fr-FR`
	** - If symbol is USD, then we will display as `123,79 $` or `$123.79` (US)
	** - If smbol is percent, then we will display as `12 %` or `12%` (US)
	** - If symbol is any other token, we will display as `123,79 USDC` or `USDC 123.79` (US)
	**********************************************************************************************/
	let locale = 'fr-FR';
	if (typeof(navigator) !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}
	const {shouldDisplaySymbol, shouldCompactValue, ...rest} = options;
	const intlOptions: Intl.NumberFormatOptions = rest;
	let isPercent = false;
	if (symbol && symbol !== '' && shouldDisplaySymbol) {
		const uppercaseSymbol = String(symbol).toLocaleUpperCase();
		const symbolToFormat = uppercaseSymbol === 'USD' ? 'USD' : 'EUR';
		intlOptions.style = uppercaseSymbol === 'PERCENT' ? 'percent' : 'currency',
		intlOptions.currency = symbolToFormat,
		intlOptions.currencyDisplay = symbolToFormat === 'EUR' ? 'code' : 'narrowSymbol';
		isPercent = uppercaseSymbol === 'PERCENT';
	}

	if (isPercent && amount > 5 && shouldCompactValue) {
		return (
			`> ${new Intl.NumberFormat([locale, 'en-US'], intlOptions)
				.format(5)
				.replace('EUR', symbol)}`
		);
	}

	/* 🔵 - Yearn Finance *************************************************************************
	** If the amount is above 10k, we will format it to short notation:
	** - 123947 would be `123,95 k` or  `123.95K` (US)
	** - 267839372 would be `267,84 M` or  `267.84M` (US)
	**********************************************************************************************/
	if (amount > 10_000 && shouldCompactValue) {
		return (
			new Intl.NumberFormat([locale, 'en-US'], {
				...intlOptions,
				notation: 'compact',
				compactDisplay: 'short'
			}).format(amount).replace('EUR', symbol)
		);
	}

	/* 🔵 - Yearn Finance *************************************************************************
	** If the amount is very small, we adjust the decimals to try to display something, up to
	** "decimals" number of decimals
	**********************************************************************************************/
	if (amount < 0.01) {
		if (amount > 0.00000001) {
			return (new Intl.NumberFormat([locale, 'en-US'], {
				...intlOptions,
				minimumFractionDigits: 8,
				maximumFractionDigits: Math.max(8, intlOptions.maximumFractionDigits || 8)
			}).format(amount).replace('EUR', symbol));
		}
		if (amount > 0.000000000001) {
			return (new Intl.NumberFormat([locale, 'en-US'], {
				...intlOptions,
				minimumFractionDigits: 12,
				maximumFractionDigits: Math.max(12, intlOptions.maximumFractionDigits || 12)
			}).format(amount).replace('EUR', symbol));
		}
		return (new Intl.NumberFormat([locale, 'en-US'], {
			...intlOptions,
			minimumFractionDigits: decimals,
			maximumFractionDigits: Math.max(decimals, intlOptions.maximumFractionDigits || decimals)
		}).format(amount).replace('EUR', symbol));
	}
	return (
		new Intl.NumberFormat([locale, 'en-US'], intlOptions)
			.format(amount)
			.replace('EUR', symbol)
	);
}
function amount(props: TAmount): string {
	const {value} = props;
	const options = assignOptions(props.options);
	const decimals = assertValidNumber(Number(props.decimals), 18, 'decimals');
	let amount = 0;
	if (typeof(value) === 'bigint') {
		amount = formatToNormalizedValue(toBigInt(value), decimals);
	} else if (typeof(value) === 'number' && !Number.isNaN(value)) {
		amount = value;
	}

	if (isZero(amount)) {
		return formatLocalAmount(0, 0, props.symbol || '', options);
	}
	if (!Number.isFinite(amount)) {
		return '∞';
	}
	return formatLocalAmount(amount, decimals, props.symbol || '', options);
}

export function RenderAmount(props: TAmount): ReactElement {
	const normalizedRawValue = useMemo((): string => {
		return (amount({
			...props,
			options: {
				...props.options,
				minimumFractionDigits: 2,
				maximumFractionDigits: Math.max(2, Number(props.decimals)),
				shouldDisplaySymbol: true,
				shouldCompactValue: false
			}
		}));
	}, [props]);

	return (
		<span
			suppressHydrationWarning
			className={isZero(props.value) ? '' : 'tooltip cursor-help underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'}>
			{isZero(props.value) ? <span /> : (
				<span suppressHydrationWarning className={'tooltipLight bottom-full mb-1'}>
					<div className={'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'}>
						{normalizedRawValue}
					</div>
				</span>
			)}
			{amount(props)}
		</span>
	);
}
