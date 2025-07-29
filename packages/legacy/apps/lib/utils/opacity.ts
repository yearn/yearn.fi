/**
 * Converts a number between 0 and 1 to a hex string representing the opacity.
 *
 * @param opacity - A number between 0 and 1 representing the opacity.
 * @returns A string representing the opacity in hex format.
 */
export const opacityToHex = (opacity: number): string => {
	const alpha = Math.round(opacity * 255);
	return alpha.toString(16).padStart(2, '0').toUpperCase();
};
