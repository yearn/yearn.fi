import { HeaderNavMenu as SharedHeaderNavMenu } from '@yearn/site-header/navigation'
import { env } from '@/env'

export function HeaderNavMenu(props: { isHomePage: boolean; isDarkTheme: boolean }) {
  return <SharedHeaderNavMenu {...props} assetBaseUrl={env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI} />
}
