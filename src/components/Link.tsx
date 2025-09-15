import type { ReactNode } from 'react'
import type { LinkProps as RouterLinkProps } from 'react-router-dom'
import { Link as RouterLink } from 'react-router-dom'
import { preloadRoute } from '../routes'

export type LinkProps = {
  href?: string
  to?: string
  children: ReactNode
  className?: string
  target?: string
  rel?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
} & Omit<RouterLinkProps, 'to'>

function isExternalLink(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.href)
    return urlObj.hostname !== window.location.hostname
  } catch {
    return false
  }
}

export default function Link(props: LinkProps): React.ReactElement {
  const { href, to, children, className, target, rel, onClick, ...rest } = props

  // Use href or to, with href taking precedence
  const url = href || to || ''

  // Check if it's an external link
  if (isExternalLink(url)) {
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

  // Internal link using React Router
  return (
    <RouterLink
      to={url}
      className={className}
      target={target}
      rel={rel}
      onClick={onClick}
      onMouseEnter={(): void => {
        if (url) preloadRoute(url)
      }}
      onFocus={(): void => {
        if (url) preloadRoute(url)
      }}
      onTouchStart={(): void => {
        if (url) preloadRoute(url)
      }}
      {...rest}
    >
      {children}
    </RouterLink>
  )
}
