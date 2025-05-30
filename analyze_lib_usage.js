#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

// Get all import statements using @lib
const importStatements = execSync(
	`grep -r "from '@lib/" . --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=apps/lib`,
	{encoding: 'utf8'}
)
	.split('\n')
	.filter(line => line.trim());

// Extract the imported paths
const importedPaths = new Set();
const importedItems = new Set();

importStatements.forEach(line => {
	const match = line.match(/from '@lib\/([^']+)'/);
	if (match) {
		const importPath = match[1];
		importedPaths.add(importPath);

		// Also extract individual imports like {cl, formatAmount}
		const itemsMatch = line.match(/import\s+[{]([^}]+)[}]/);
		if (itemsMatch) {
			const items = itemsMatch[1].split(',').map(item => item.trim().replace(/^type\s+/, ''));
			items.forEach(item => importedItems.add(item));
		}
	}
});

console.log('=== IMPORTED PATHS ===');
Array.from(importedPaths)
	.sort()
	.forEach(path => console.log(path));

console.log('\n=== IMPORTED ITEMS ===');
Array.from(importedItems)
	.sort()
	.forEach(item => console.log(item));

// Get all files in apps/lib
const libFiles = execSync('find apps/lib -name "*.ts" -o -name "*.tsx" -o -name "*.js"', {encoding: 'utf8'})
	.split('\n')
	.filter(line => line.trim())
	.map(file => file.replace('apps/lib/', ''));

console.log('\n=== ALL LIB FILES ===');
libFiles.sort().forEach(file => console.log(file));

// Find unused files
const usedFiles = new Set();

importedPaths.forEach(importPath => {
	// Check for exact matches
	const possibleFiles = [
		`${importPath}.ts`,
		`${importPath}.tsx`,
		`${importPath}.js`,
		`${importPath}/index.ts`,
		`${importPath}/index.tsx`,
		`${importPath}/index.js`
	];

	possibleFiles.forEach(file => {
		if (libFiles.includes(file)) {
			usedFiles.add(file);
		}
	});
});

console.log('\n=== USED FILES ===');
Array.from(usedFiles)
	.sort()
	.forEach(file => console.log(file));

const unusedFiles = libFiles.filter(file => !usedFiles.has(file));
console.log('\n=== UNUSED FILES ===');
unusedFiles.sort().forEach(file => console.log(file));

console.log(`\nSummary: ${usedFiles.size} used, ${unusedFiles.size} unused out of ${libFiles.length} total files`);
