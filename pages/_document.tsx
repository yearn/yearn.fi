import Document, {Head, Html, Main, NextScript} from 'next/document';

import type {DocumentContext, DocumentInitialProps} from 'next/document';
import type {ReactElement} from 'react';

const modeScript = `
  let darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  updateMode()
  darkModeMediaQuery.addEventListener('change', updateModeWithoutTransitions)
  window.addEventListener('storage', updateModeWithoutTransitions)

  function updateMode() {
    let isSystemDarkMode = darkModeMediaQuery.matches
    let isDarkMode = window.localStorage.isDarkMode === 'true' || (!('isDarkMode' in window.localStorage) && isSystemDarkMode)

    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    if (isDarkMode === isSystemDarkMode) {
      delete window.localStorage.isDarkMode
    }
  }

  function updateModeWithoutTransitions() {
    updateMode()
  }
`;


// export const indexedWagmiChains = Object.values(wagmiChains).reduce((acc: {[key: number]: TExtendedChain}, chain: Chain): {[key: number]: any} => {
// 	const extendedChain = chain as any;
// 	if (!chain?.rpcUrls?.public?.http?.[0]) {
// 		console.warn('No RPC URL for chain', chain);
// 	}
// 	console.warn(extendedChain);
// 	acc[chain.id] = extendedChain;
// 	return acc;
// }, {});



class MyDocument extends Document {
	static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
		const initialProps = await Document.getInitialProps(ctx);
		return {...initialProps};
	}

	render(): ReactElement {
		return (
			<Html lang={'en'}>
				<Head>
					<script dangerouslySetInnerHTML={{__html: modeScript}} />
				</Head>
				<body className={'bg-neutral-0 transition-colors duration-150'}>
					<Main />
					<NextScript />
				</body>
			</Html>
		);
	}
}

export default MyDocument;
