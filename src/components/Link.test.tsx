/**
 * Example usage of the Link component
 *
 * The Link component automatically detects whether a URL is internal or external
 * and renders the appropriate element (React Router Link or standard anchor tag)
 */

import Link from './Link'

// Example usages:
export function LinkExamples() {
  return (
    <div>
      {/* Internal links - will use React Router */}
      <Link href="/apps">Go to Apps</Link>
      <Link href="/vaults">View Vaults</Link>
      <Link to="/v3">V3 Vaults</Link>

      {/* External links - will use standard anchor tags with target="_blank" */}
      <Link href="https://twitter.com/yearnfi">Twitter</Link>
      <Link href="https://github.com/yearn">GitHub</Link>

      {/* Custom styling */}
      <Link href="/vaults/about" className="text-blue-600 hover:text-blue-800 underline">
        Learn about Vaults
      </Link>

      {/* External link with custom target/rel */}
      <Link href="https://docs.yearn.fi" target="_self" rel="noopener">
        Documentation
      </Link>

      {/* With onClick handler */}
      <Link href="/apps" onClick={(e) => console.log('Link clicked:', e)}>
        Apps with tracking
      </Link>
    </div>
  )
}
