import React, {createContext, useContext} from 'react';
import useSWR from 'swr';
import {baseFetcher} from 'utils';

import type {TYDaemonHarvests} from 'types/yearn';


export type	TYCRVContext = {
	yCRVHarvests: TYDaemonHarvests[],
}
const	defaultProps: TYCRVContext = {
	yCRVHarvests: []
};


const	YCRVContext = createContext<TYCRVContext>(defaultProps);
export const YCRVContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const	{data: yCRVHarvests} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/1/vaults/harvests/${process.env.STYCRV_TOKEN_ADDRESS},${process.env.LPYCRV_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	return (
		<YCRVContext.Provider
			value={{yCRVHarvests}}>
			{children}
		</YCRVContext.Provider>
	);
};


export const useYCRV = (): TYCRVContext => useContext(YCRVContext);
export default useYCRV;