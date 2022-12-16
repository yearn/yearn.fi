import {createContext, useState} from 'react';

type TVaultCategoryContext = {category: string; set_category: (c: string) => void};

const defaultProps = {
	category: '',
	set_category: (): void => undefined
};

export const VaultCategoryContext = createContext<TVaultCategoryContext>(defaultProps);

export const VaultCategoryContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const [category, set_category] = useState('Featured Vaults');

	return (
		<VaultCategoryContext.Provider value={{category, set_category}}>
			{children}
		</VaultCategoryContext.Provider>
	);
};
