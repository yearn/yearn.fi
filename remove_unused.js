#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const unusedFiles = [
	'contexts/useWallet.tsx',
	'hooks/useApprove.ts',
	'hooks/useBalances.monochain.ts',
	'hooks/useBridge.ts',
	'hooks/useDeposit.ts',
	'hooks/useMultichainPrices.ts',
	'hooks/usePermit.ts',
	'hooks/usePermit.types.ts',
	'hooks/usePortals.ts',
	'hooks/usePrices.ts',
	'hooks/useWithdraw.ts',
	'hooks/useYDaemonBaseUri.ts',
	'types/prices.ts',
	'types/solvers.ts',
	'utils/abi/4626.abi.ts',
	'utils/abi/4626Router.abi.ts',
	'utils/abi/usdt.abi.ts',
	'utils/abi/vaultV2.abi.ts',
	'utils/api.portals.ts',
	'utils/assert.ts',
	'utils/fetchers.ts',
	'utils/handlers.ts',
	'utils/helpers.ts',
	'utils/tools.gnosis.ts',
	'utils/tools.identifier.ts',
	'utils/tools.math.ts',
	'utils/wagmi/actions.ts',
	'utils/wagmi/config.ts',
	'utils/wagmi/networks.ts',
	'utils/wagmi/provider.ts',
	'utils/wagmi/transaction.ts'
];

console.log('Removing unused files from apps/lib...');

let removedCount = 0;
let errorCount = 0;

unusedFiles.forEach(file => {
	const fullPath = path.join('apps/lib', file);
	try {
		if (fs.existsSync(fullPath)) {
			fs.unlinkSync(fullPath);
			console.log(`✓ Removed: ${file}`);
			removedCount++;
		} else {
			console.log(`⚠ File not found: ${file}`);
		}
	} catch (error) {
		console.log(`✗ Error removing ${file}: ${error.message}`);
		errorCount++;
	}
});

console.log(`\nSummary: ${removedCount} files removed, ${errorCount} errors`);

// Remove empty directories
const emptyDirs = [];
function findEmptyDirs(dir) {
	try {
		const files = fs.readdirSync(dir);
		if (files.length === 0) {
			emptyDirs.push(dir);
		} else {
			files.forEach(file => {
				const fullPath = path.join(dir, file);
				if (fs.statSync(fullPath).isDirectory()) {
					findEmptyDirs(fullPath);
				}
			});

			// Check again after recursion
			const remainingFiles = fs.readdirSync(dir);
			if (remainingFiles.length === 0) {
				emptyDirs.push(dir);
			}
		}
	} catch (error) {
		// Directory doesn't exist or permission error
	}
}

findEmptyDirs('apps/lib');

emptyDirs.forEach(dir => {
	try {
		fs.rmdirSync(dir);
		console.log(`✓ Removed empty directory: ${dir}`);
	} catch (error) {
		console.log(`✗ Error removing directory ${dir}: ${error.message}`);
	}
});
