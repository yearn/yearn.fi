import React from 'react';

import type {ReactElement} from 'react';

function	Index(): ReactElement {
	return (
		<div className={'mx-auto mt-20 mb-44 flex w-full max-w-6xl flex-col items-center justify-center'}>
			<div className={'relative h-12 w-[300px] md:h-[104px] md:w-[600px]'}>
				{'Soon (2027)'}
			</div>
		</div>
	);
}

Index.getLayout = function getLayout(page: ReactElement): ReactElement {
	return page;
};

export default Index;