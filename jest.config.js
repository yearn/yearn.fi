/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleNameMapper: {
		'@vaults/(.*)': ['<rootDir>/apps/vaults/$1']
	},
	transform: {}
};
