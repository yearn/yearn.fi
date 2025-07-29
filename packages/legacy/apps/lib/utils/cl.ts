/**
 * Joins the given classes into a single string.
 * @example cl('foo', 'bar') // 'foo bar'
 * @example cl('foo', false && 'bar') // 'foo'
 *
 * @param classes the classes to be joined
 * @returns the joined classes
 */
export function cl(...classes: (string | null | undefined)[]): string {
	return classes.filter(Boolean).join(' ');
}
