/** @type {import('vite').UserConfig} */

import path from 'path';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default {
	plugins: [react()],
	resolve: {
		alias: {
			'@vaults': path.resolve(__dirname, './apps/vaults'),
			'@lib': path.resolve(__dirname, './apps/lib')
		}
	},
	test: {
		globals: true,
		environment: 'node',
		deps: {
			inline: ['@lib']
		}
	}
};
