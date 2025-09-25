import { useEffect } from 'react'
import type { ReactElement } from 'react'

type TMeta = {
  title: string
  titleColor: string
  themeColor: string
  description: string
  og: string
  uri: string
}

export function Meta(meta: TMeta): ReactElement {
  useEffect(() => {
    // Update title
    document.title = meta.title

    // Helper function to update or create meta tags
    const updateMetaTag = (selector: string, attribute: string, value: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement
      if (!element) {
        if (selector.startsWith('meta')) {
          element = document.createElement('meta')
        } else {
          element = document.createElement('link')
        }
        document.head.appendChild(element)
        // Set the attributes to match the selector
        const matches = selector.match(/\[([^=]+)="([^"]+)"\]/)
        if (matches) {
          element.setAttribute(matches[1], matches[2])
        }
      }
      element.setAttribute(attribute, value)
    }

    // Update meta tags
    updateMetaTag('meta[name="description"]', 'content', meta.description)
    updateMetaTag('meta[name="msapplication-TileColor"]', 'content', meta.titleColor)
    updateMetaTag('meta[name="theme-color"]', 'content', meta.themeColor)
    updateMetaTag('meta[name="application-name"]', 'content', meta.title)
    updateMetaTag('meta[name="apple-mobile-web-app-title"]', 'content', meta.title)
    updateMetaTag('meta[name="apple-mobile-web-app-capable"]', 'content', 'yes')
    updateMetaTag('meta[name="apple-mobile-web-app-status-bar-style"]', 'content', 'default')
    updateMetaTag('meta[name="format-detection"]', 'content', 'telephone=no')
    updateMetaTag('meta[name="mobile-web-app-capable"]', 'content', 'yes')
    updateMetaTag('meta[name="msapplication-config"]', 'content', '/favicons/browserconfig.xml')
    updateMetaTag('meta[name="msapplication-tap-highlight"]', 'content', 'no')
    updateMetaTag('meta[name="googlebot"]', 'content', 'index,nofollow')

    // Twitter meta tags
    updateMetaTag('meta[property="twitter:image"]', 'content', meta.og)
    updateMetaTag('meta[property="twitter:card"]', 'content', 'summary_large_image')
    updateMetaTag('meta[property="twitter:title"]', 'content', meta.title)
    updateMetaTag('meta[property="twitter:description"]', 'content', meta.description)

    // Open Graph meta tags
    updateMetaTag('meta[property="og:image"]', 'content', meta.og)
    updateMetaTag('meta[property="og:url"]', 'content', meta.uri)
    updateMetaTag('meta[property="og:title"]', 'content', meta.title)
    updateMetaTag('meta[property="og:description"]', 'content', meta.description)

    // Links
    updateMetaTag('link[rel="manifest"]', 'href', '/manifest.json')
    updateMetaTag('link[rel="mask-icon"]', 'color', meta.themeColor)
    updateMetaTag('link[rel="mask-icon"]', 'href', '/favicons/safari-pinned-tab.svg')
  }, [meta.title, meta.description, meta.titleColor, meta.themeColor, meta.og, meta.uri])

  return <></>
}
