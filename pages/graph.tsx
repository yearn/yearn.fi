import React from 'react';
import dynamic from 'next/dynamic';

import type {LoaderComponent} from 'next/dynamic';
import type {ReactElement} from 'react';

const Graph = dynamic<any>(async (): LoaderComponent<any> => import('apps/Graph'), {ssr: false});

function	Index(): ReactElement {
	return (
		<Graph />
	);

}

export default Index;
