import React, {createContext, useContext} from 'react';

export type TBeefyContext = {
	foo: string;
}

const defaultProps: TBeefyContext = {
	foo: 'bar'
};

const CurveContext = createContext<TBeefyContext>(defaultProps);

export const BeefyContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	return (
		<CurveContext.Provider value={{foo: 'baz'}}>
			{children}
		</CurveContext.Provider>
	);
};


export const useCurve = (): TBeefyContext => useContext(CurveContext);
export default useCurve;