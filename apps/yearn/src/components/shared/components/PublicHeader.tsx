'use client'

import { HeaderNavMenu } from '@shared/components/HeaderNavMenu'
import { SiteHeader } from '@yearn/site-header'

export function PublicHeader() {
  return <SiteHeader isHomePage isDarkTheme navigation={<HeaderNavMenu isHomePage isDarkTheme />} />
}
