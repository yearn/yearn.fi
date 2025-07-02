import React, {createContext, useContext} from 'react';
import setupIndexedDB from 'use-indexeddb';
import {useMountEffect} from '@react-hookz/web';

import type {IndexedDBConfig} from 'use-indexeddb/dist/interfaces';

const gimmeIDBConfig: IndexedDBConfig = {
	databaseName: 'gimme',
	version: 1,
	stores: [
		{
			name: 'notifications',
			id: {keyPath: 'id', autoIncrement: true},
			indices: [
				{name: 'fromAddress', keyPath: 'fromAddress'},
				{name: 'fromChainId', keyPath: 'fromChainId'},
				{name: 'fromTokenName', keyPath: 'fromTokenName'},
				{name: 'fromAmount', keyPath: 'fromAmount'},
				{name: 'toAddress', keyPath: 'toAddress'},
				{name: 'toChainId', keyPath: 'toChainId'},
				{name: 'toTokenName', keyPath: 'toTokenName'},
				{name: 'toAmount', keyPath: 'toAmount'},
				{name: 'status', keyPath: 'status'}
			]
		}
	]
};

const defaultProps = gimmeIDBConfig;
const IndexDBContext = createContext<IndexedDBConfig>(defaultProps);
export const IndexedDB = ({children}: {children: React.ReactElement}): React.ReactElement => {
	useMountEffect(async () => {
		setupIndexedDB(gimmeIDBConfig);
	});

	return <IndexDBContext.Provider value={gimmeIDBConfig}>{children}</IndexDBContext.Provider>;
};

export const useIndexDB = (): IndexedDBConfig => {
	const ctx = useContext(IndexDBContext);
	if (!ctx) {
		throw new Error('IndexDBContext not found');
	}
	return ctx;
};
