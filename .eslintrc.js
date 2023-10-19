module.exports = {
	'extends': ['./node_modules/@yearn-finance/web-lib/.eslintrc.cjs', 'plugin:react-hooks/recommended'],
	'parser': '@typescript-eslint/parser',
	'parserOptions': {
		'ecmaFeatures': {
			'jsx': true
		},
		'tsconfigRootDir': __dirname,
		'ecmaVersion': 2022,
		'sourceType': 'module',
		'project': ['./tsconfig.json']
	},
	'rules': {
		'@typescript-eslint/prefer-optional-chain': 'error',
		'indent': 'off',
		'@typescript-eslint/indent': ['error', 'tab'],
		'no-multi-spaces': ['error', {ignoreEOLComments: false}],
		'no-mixed-spaces-and-tabs': 'error',
		'react/jsx-max-props-per-line': 'off',
		'react-hooks/exhaustive-deps': [
			'warn', {
				'additionalHooks': '(^useAsyncTrigger$|^useDeepCompareMemo$)'
			}
		]
	}
};
