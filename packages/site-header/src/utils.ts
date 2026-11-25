export const cl = (...values: (string | false | null | undefined)[]): string => values.filter(Boolean).join(' ')
