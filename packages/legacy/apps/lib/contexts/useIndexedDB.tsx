import {useMountEffect} from '@react-hookz/web';
import type React from 'react';
import {createContext, useContext} from 'react';
import setupIndexedDB from 'use-indexeddb';

import type {IndexedDBConfig} from 'use-indexeddb/dist/interfaces';

const yearnIDBConfig: IndexedDBConfig = {
	databaseName: 'yearn-notifications',
	version: 1,
	stores: [
		{
			name: 'notifications',
			id: {keyPath: 'id', autoIncrement: true},
			indices: [
				{name: 'chainId', keyPath: 'chainId'},
				{name: 'amount', keyPath: 'amount'},
				{name: 'blockNumber', keyPath: 'blockNumber'},
				{name: 'fromAddress', keyPath: 'fromAddress'},
				{name: 'fromTokenName', keyPath: 'fromTokenName'},
				{name: 'spenderAddress', keyPath: 'spenderAddress'},
				{name: 'spenderName', keyPath: 'spenderName'},
				{name: 'toAddress', keyPath: 'toAddress'},
				{name: 'toTokenName', keyPath: 'toTokenName'},
				{name: 'status', keyPath: 'status'},
				{name: 'timeFinished', keyPath: 'timeFinished'},
				{name: 'txHash', keyPath: 'txHash'}
			]
		}
	]
};

const defaultProps = yearnIDBConfig;
const IndexDBContext = createContext<IndexedDBConfig>(defaultProps);
export const IndexedDB = ({children}: {children: React.ReactElement}): React.ReactElement => {
	useMountEffect(async () => {
		setupIndexedDB(yearnIDBConfig);
	});

	return <IndexDBContext.Provider value={yearnIDBConfig}>{children}</IndexDBContext.Provider>;
};

export const useIndexDB = (): IndexedDBConfig => {
	const ctx = useContext(IndexDBContext);
	if (!ctx) {
		throw new Error('IndexDBContext not found');
	}
	return ctx;
};
