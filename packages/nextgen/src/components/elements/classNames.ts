import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type ThemeName = 'default' | 'disabled' | 'busy' | 'error'
export type Hierarchy = 'primary' | 'secondary'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
	className?: string
	h?: Hierarchy
	header?: React.ReactNode
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	className?: string
	theme?: ThemeName
	h?: Hierarchy
}

export function cardClassName(props: CardProps) {
	const { className, h } = props
	const bg = h === 'secondary' ? 'bg-secondary-800' : 'bg-primary-100'
	const text = h === 'secondary' ? 'text-primary-50' : ''
	const outline = h === 'secondary' ? 'outline-secondary-400/40' : 'outline-primary-400/40'
	return cn(`relative rounded-primary p-6 flex flex-col gap-3 drop-shadow-6 drop-shadow-neutral-500/40
    ${bg} ${text} outline-0 ${outline} ${className}`)
}

export function vaultCardContainerClassName() {
	return cn(`group grow sm:h-32 mx-8 my-6
    grid items-stretch gap-8
    grid-rows-1 data-[has-balance=true]:grid-rows-2
    sm:grid-rows-none sm:data-[has-balance=true]:grid-rows-none
    sm:grid-cols-1 sm:data-[has-balance=true]:grid-cols-[1fr_1fr]      
    font-mono`)
}

export function buttonClassName(props: ButtonProps) {
	const { className, theme, h } = props
	const busy = theme === 'busy'
	const bg = theme === 'error' ? 'bg-red-500' : h === 'secondary' ? 'bg-secondary-900' : 'bg-primary-50'
	const text = theme === 'error' ? 'text-red-50' : h === 'secondary' ? 'text-neutral-300' : 'text-secondary-600'
	return cn(`
    relative h-8 px-8 py-5 flex items-center justify-center
    ${bg} text-2xl ${text} tracking-wide
    drop-shadow-4 drop-shadow-secondary-600/60

    hover:text-primary-50 hover:bg-neutral-900 hover:border-secondary-50

    active:text-primary-50 active:border-secondary-400 active:bg-secondary-900
    active:translate-1 active:drop-shadow-none

    disabled:bg-primary-50
    disabled:text-secondary-200
    disabled:hover:text-secondary-200
    disabled:cursor-default
    disabled:drop-shadow-none
    disabled:pointer-events-none

    data-[theme=error]:drop-shadow-none

    cursor-pointer rounded-primary whitespace-nowrap
    ${(busy || theme === 'error') && 'pointer-events-none'}
    ${`theme-${theme ?? 'default'}`}
    ${className}`)
}
