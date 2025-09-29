# Meta Handler Hardening

## Summary
- Scope: `api/vault/meta.ts`
- Goal: eliminate reflected/scripting injection risk by validating inputs and escaping generated markup.

## Changes
- Added strict validators for `chainId` and `address` query parameters and normalised values before use.
- Escaped HTML attribute values to prevent crafted input from breaking out of meta tags.
- URL-encoded dynamic path segments for the OpenGraph image and canonical URL.
- Lowercased vault addresses to keep links canonical.
- Renamed unused fallback error variable to appease linting.

## Impact
- Requests with unexpected `chainId`/`address` formats now return `400` instead of serving attacker-controlled HTML.
- Rendered meta tags are safe against attribute injection, closing the reflected XSS vector.
- Behaviour for valid vault pages remains unchanged aside from normalised formatting.
