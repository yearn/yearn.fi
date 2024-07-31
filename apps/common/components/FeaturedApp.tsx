import type {TApp} from 'pages/home/[category]';
import type {ReactElement} from 'react';

export function FeaturedApp(props: {app: TApp}): ReactElement {
	return (
		<div
			className={
				'relative flex w-full flex-col justify-end bg-center px-6 py-10 outline outline-1 outline-gray-800/50  lg:h-[520px]'
			}
			style={{
				backgroundImage: `url(${props.app.image})`
			}}>
			<div
				style={{background: 'linear-gradient(180deg, rgba(12, 12, 12, 0) 0%, #0C0C0C 100%)'}}
				className={'absolute left-0 top-0 size-full'}
			/>
			<p className={'z-20 text-xl font-bold text-white'}>{props.app.title}</p>
		</div>
	);
}
