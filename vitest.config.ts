/** @type {import('vite').UserConfig} */

import path from 'path';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default {
	plugins: [react()],
	resolve: {
		alias: {
			'@vaults': path.resolve(__dirname, './apps/vaults'),
			'@common': path.resolve(__dirname, './apps/common'),
			'@veYFI': path.resolve(__dirname, './apps/veyfi'),
			'@yBribe': path.resolve(__dirname, './apps/ybribe'),
			'@yCRV': path.resolve(__dirname, './apps/ycrv')
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
