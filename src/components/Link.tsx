import type { ReactNode } from 'react'
import type { LinkProps as NavigationLinkProps } from '@/navigation/client'
import { Link as NavigationLink } from '@/navigation/client'
import { resolveLinkTarget } from '@/navigation/url'

export type LinkProps = {
  href?: string
  to?: string
  children: ReactNode
  className?: string
  target?: string
  rel?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
} & Omit<NavigationLinkProps, 'to'>

export default function Link(props: LinkProps): React.ReactElement {
  const { href, to, children, className, target, rel, onClick, ...rest } = props

  // Use href or to, with href taking precedence
  const { href: url, isExternal } = resolveLinkTarget(href || to || '')

  // Check if it's an external link
  if (isExternal) {
    return (
      <a
        href={url}
        className={className}
        target={target || '_blank'}
        rel={rel || 'noopener noreferrer'}
        onClick={onClick}
        {...rest}
      >
        {children}
      </a>
    )
  }

  // Internal link using the Next navigation adapter.
  return (
    <NavigationLink to={url} className={className} target={target} rel={rel} onClick={onClick} {...rest}>
      {children}
    </NavigationLink>
  )
}
