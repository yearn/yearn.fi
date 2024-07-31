import {useEffect, useRef, useState} from 'react';
import {motion} from 'framer-motion';

import {FeaturedApp} from './FeaturedApp';

import type {TApp} from 'pages/home/[category]';
import type {ReactElement} from 'react';

export function AppsCarousel(props: {apps: TApp[]}): ReactElement {
	const targetRef = useRef<HTMLDivElement | null>(null);
	const [width, set_width] = useState(0);

	useEffect(() => {
		set_width(Number(targetRef.current?.scrollWidth) - Number(targetRef.current?.offsetWidth));
	}, []);

	return (
		<section
			ref={targetRef}
			className={'relative'}>
			<motion.div
				drag={'x'}
				dragConstraints={{
					right: 0,
					left: -width
				}}
				className={'flex gap-x-6'}>
				{props.apps.map(app => (
					<FeaturedApp app={app} />
				))}
			</motion.div>
		</section>
	);
}
