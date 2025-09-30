# Markdown Sanitization Update

## Summary
- Scope: `apps/lib/utils/helpers.ts::parseMarkdown`
- Goal: eliminate stored XSS risk from vault descriptions and notices while preserving lightweight markdown support.

## Changes
- Replaced the regex-based helper with a small recursive parser that escapes all user-provided text and only emits a safe subset of HTML (`<a>`, `<span>` for bold/strikethrough).
- Enforced URL allowlisting (http/https/mailto or relative paths) and attribute escaping, and added `rel="noopener noreferrer"` for external links.
- Retained support for bold (`**`), strikethrough (`~~`), links, literal `<br>` tags, and newline conversion while preventing nested links.
- Allowed documentation files to be tracked by removing the `/docs` ignore rule.

## Impact
- Vault descriptions/notices rendered via `dangerouslySetInnerHTML` now produce sanitized HTML, closing the stored XSS vector.
- Markdown rendering continues to work for the supported inline syntax without pulling a large dependency into the bundle.
- Unsafe or unsupported markdown patterns gracefully degrade to escaped text.
