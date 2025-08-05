import type React from 'react'
import type { ReactElement } from 'react'

export function IconWallet(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg width={24} height={24} fill={'none'} xmlns={'http://www.w3.org/2000/svg'} viewBox={'0 0 24 24'} {...props}>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={
					'M16.583 11.09c-1.518 0-2.75 1.223-2.75 2.728 0 1.506 1.232 2.728 2.75 2.728 1.519 0 2.75-1.222 2.75-2.728 0-1.505-1.231-2.727-2.75-2.727Zm-.916 2.728c0-.501.41-.909.916-.909s.917.408.917.91c0 .5-.41.908-.917.908a.914.914 0 0 1-.916-.909Z'
				}
				fill={'currentcolor'}
			/>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={
					'M2.833 4.727c0-.501.411-.909.917-.909h16.5a.913.913 0 0 0 .917-.909c0-.502-.41-.909-.917-.909H3.75C2.232 2 1 3.222 1 4.727v12.727C1 19.965 3.052 22 5.583 22H20.25c1.518 0 2.75-1.222 2.75-2.727V8.363c0-1.505-1.232-2.727-2.75-2.727H3.75a.914.914 0 0 1-.917-.909Zm0 12.727V7.3c.287.1.596.156.917.156h16.5c.506 0 .917.407.917.909v10.909c0 .501-.411.909-.917.909H5.583c-1.518 0-2.75-1.221-2.75-2.727Z'
				}
				fill={'currentcolor'}
			/>
		</svg>
	)
}
