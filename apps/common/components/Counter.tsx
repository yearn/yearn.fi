import {useLayoutEffect, useRef} from 'react';
import {animate} from 'framer-motion';
import {formatAmount, parseAmount} from '@builtbymom/web3/utils';

import type {ReactElement} from 'react';

export function Counter({
	value,
	decimals = 18,
	idealDecimals,
	decimalsToDisplay
}: {
	value: number; // Value to animate
	decimals: number; // Number of decimals of that token
	idealDecimals?: number; // Ideal decimals to display
	decimalsToDisplay?: number[]; // Decimals to display
}): ReactElement {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const nodeRef = useRef<any>();
	const valueRef = useRef(value || 0);

	useLayoutEffect((): (() => void) => {
		const node = nodeRef.current;
		if (node) {
			const controls = animate(Number(valueRef.current || 0), value, {
				duration: 1,
				onUpdate(value) {
					let hasBeenSet = false;
					valueRef.current = value;
					if (Number.isNaN(value) || value === 0) {
						const formatedValue = formatAmount(0, idealDecimals, idealDecimals);
						node.textContent = formatedValue;
					} else if (decimalsToDisplay && decimalsToDisplay.length > 0) {
						const allDecimalsToTests = [...decimalsToDisplay, decimals];
						if (idealDecimals) {
							allDecimalsToTests.unshift(idealDecimals);
						}
						for (const decimalToDisplay of allDecimalsToTests) {
							if (decimalToDisplay > decimals) {
								const formatedValue = formatAmount(value.toFixed(decimals), decimals, decimals);
								node.textContent = formatedValue;
								hasBeenSet = true;
								break;
							}
							const formatedValue = formatAmount(
								value.toFixed(decimals),
								decimalToDisplay,
								decimalToDisplay
							);
							if (
								Number.isNaN(parseAmount(formatedValue)) ||
								formatedValue === 'NaN' ||
								parseAmount(formatedValue) === 0
							) {
								continue;
							}
							node.textContent = formatedValue;
							hasBeenSet = true;
							break;
						}
						if (!hasBeenSet) {
							if (Number.isNaN(value) || value === 0) {
								const formatedValue = formatAmount(0, idealDecimals, idealDecimals);
								node.textContent = formatedValue;
							} else {
								const formatedValue = formatAmount(value.toFixed(decimals), decimals, decimals);
								node.textContent = formatedValue;
							}
						}
					} else {
						const formatedValue = formatAmount(
							value.toFixed(decimals),
							decimals || idealDecimals,
							decimals || idealDecimals
						);
						node.textContent = formatedValue;
					}
				}
			});
			return () => controls.stop();
		}
		return () => undefined;
	}, [value, decimals, decimalsToDisplay, idealDecimals]);

	return (
		<span
			className={'font-number'}
			suppressHydrationWarning
			ref={nodeRef}
		/>
	);
}
