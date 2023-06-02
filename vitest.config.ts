import path from 'path';
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@vaults': path.resolve(__dirname, './apps/vaults'),
			'@yBal': path.resolve(__dirname, './apps/ybal'),
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
});
