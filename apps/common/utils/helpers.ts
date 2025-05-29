/**
 * Replace multiple string instances in a single string
 * @param inputString
 * @param stringsToReplace
 * @param replacement
 */
export const replaceStrings = (inputString: string, stringsToReplace: string[], replacement: string): string => {
	return stringsToReplace.reduce((outputString, stringToReplace) => {
		const regex = new RegExp(stringToReplace, 'g');
		return outputString.replace(regex, replacement);
	}, inputString);
};
