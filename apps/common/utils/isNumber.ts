export function isNumber(value: string | number): value is number {
	return !isNaN(+value);
}
