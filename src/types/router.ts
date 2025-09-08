export interface RouterType {
  pathname: string
  asPath: string
  query: Record<string, string | string[] | undefined>
  replace: (url: any, as?: string, options?: any) => Promise<boolean>
  push: (url: any, as?: string, options?: any) => Promise<boolean>
  back: () => void
}