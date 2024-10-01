import type {ReactElement} from 'react';

export function LogoTwitterRound(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'24'}
			height={'24'}
			viewBox={'0 0 24 24'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={
					'M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24ZM18.1726 6H16.0258L12.4883 9.83446L9.4298 6H5L10.2929 12.5631L5.27646 18H7.42451L11.2962 13.8049L14.6799 18H19L13.4825 11.0831L18.1726 6ZM16.4619 16.7815H15.2724L7.50693 7.15446H8.78343L16.4619 16.7815Z'
				}
				fill={'white'}
			/>
		</svg>
	);
}
