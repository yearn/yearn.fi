/** @type {import('vite').UserConfig} */

import path from 'path';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default {
	plugins: [react()],
	resolve: {
		alias: {
			'@vaults': path.resolve(__dirname, './apps/vaults'),
			'@vaults-v2': path.resolve(__dirname, './apps/vaults-v2'),
			'@vaults-v3': path.resolve(__dirname, './apps/vaults-v3'),
			'@common': path.resolve(__dirname, './apps/common')
		}
	},
	test: {
		globals: true,
		environment: 'node',
		deps: {
			inline: ['@yearn-finance/web-lib']
		}
	}
};
