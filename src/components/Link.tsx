'use client'

import NextLink from 'next/link'
import type { ReactNode } from 'react'

export type LinkProps = {
  href?: string
  to?: string
  children: ReactNode
  className?: string
  target?: string
  rel?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  prefetch?: boolean
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>

function isExternalLink(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:)/i.test(url)
}

export default function Link(props: LinkProps): React.ReactElement {
  const { href, to, children, className, target, rel, onClick, prefetch, ...rest } = props

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

  // Internal link using Next.js routing.
  return (
    <NextLink
      href={url}
      className={className}
      target={target}
      rel={rel}
      onClick={onClick}
      prefetch={prefetch}
      {...rest}
    >
      {children}
    </NextLink>
  )
}
