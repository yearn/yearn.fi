import type { ReactElement } from 'react'

export function Wrapper({ children }: { children: ReactElement }): ReactElement {
  return <div className={'mx-auto my-0 max-w-[1232px] pt-4 md:mb-0 md:mt-16'}>{children}</div>
}
