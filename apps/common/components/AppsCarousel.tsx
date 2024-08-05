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
			<div
				className={
					'pointer-events-none absolute -left-36 top-0 z-10 h-full w-1/6 bg-gradient-to-r from-gray-900 to-transparent'
				}
			/>
			<div
				className={
					'pointer-events-none absolute right-0 top-0 z-10 h-full w-1/5 bg-gradient-to-l from-gray-900 to-transparent'
				}
			/>
			<motion.div
				drag={'x'}
				dragConstraints={{
					right: 0,
					left: -width
				}}
				className={'flex gap-x-6'}>
				{props.apps.map((app, i) => (
					<FeaturedApp
						key={app.name + i}
						app={app}
					/>
				))}
			</motion.div>
		</section>
	);
}
