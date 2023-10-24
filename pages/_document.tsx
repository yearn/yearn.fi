import Document, {Head, Html, Main, NextScript} from 'next/document';

import type {DocumentContext, DocumentInitialProps} from 'next/document';
import type {ReactElement} from 'react';

const modeScript = `
let darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

updateMode();
darkModeMediaQuery.addEventListener('change', updateModeWithoutTransitions);
window.addEventListener('storage', updateModeWithoutTransitions);

function updateMode() {
	let isSystemDarkMode = darkModeMediaQuery.matches;
	let isDarkMode = window.localStorage.isDarkMode === 'true' || (!('isDarkMode' in window.localStorage) && isSystemDarkMode);
	let isV3 = window.location.pathname.includes('vaults-v3');

	if (isV3) {
		document.documentElement.classList.add('v3');
		document.documentElement.classList.remove('dark');
	} else if (isDarkMode) {
		document.documentElement.classList.add('dark');
		document.documentElement.classList.remove('v3');
	} else {
		document.documentElement.classList.remove('v3');
		document.documentElement.classList.remove('dark');
	}

	if (isDarkMode === isSystemDarkMode) {
		delete window.localStorage.isDarkMode;
	}
}

function updateModeWithoutTransitions() {
	updateMode();
}
`;

class MyDocument extends Document {
	static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps> {
		const initialProps = await Document.getInitialProps(ctx);
		return {...initialProps};
	}

	render(): ReactElement {
		return (
			<Html
				lang={'en'}
				className={'bg-neutral-0 transition-colors duration-150'}>
				<Head>
					<script dangerouslySetInnerHTML={{__html: modeScript}} />
				</Head>
				<body>
					<Main />
					<NextScript />
				</body>
			</Html>
		);
	}
}

export default MyDocument;
