# Next.js to React Router Migration Guide

This directory contains scripts to help migrate your Next.js application to use React Router and custom Image/Link components.

## Migration Scripts

### 1. Basic Migration Script (`migrate-nextjs-imports.js`)

A simple regex-based migration script that handles common patterns.

**Usage:**
```bash
node migrate-nextjs-imports.js
```

**Features:**
- Replaces `next/image` imports with `/src/components/Image`
- Replaces `next/link` imports with `/src/components/Link`
- Converts `next/router` imports to `react-router-dom` equivalents
- Transforms router.push() calls to navigate()
- Updates router.query to use params
- Basic pattern matching with regex

### 2. Advanced Migration Script (`migrate-nextjs-imports-advanced.js`)

An AST-based migration script using Babel for more accurate transformations.

**Usage:**
```bash
node migrate-nextjs-imports-advanced.js
```

**Features:**
- Uses Abstract Syntax Tree (AST) parsing for accurate transformations
- Handles complex import patterns and edge cases
- Properly manages import deduplication
- Generates a detailed migration report
- Preserves code formatting and comments
- Handles dynamic imports
- Better error handling and progress reporting

## What Gets Migrated

### Import Replacements

| Next.js Import | Replaced With |
|----------------|---------------|
| `import Image from 'next/image'` | `import Image from '/src/components/Image'` |
| `import Link from 'next/link'` | `import Link from '/src/components/Link'` |
| `import { useRouter } from 'next/router'` | `import { useNavigate, useParams, useLocation } from 'react-router-dom'` |
| `import { usePathname } from 'next/navigation'` | `import { useLocation } from 'react-router-dom'` |

### Code Transformations

| Next.js Pattern | React Router Equivalent |
|-----------------|------------------------|
| `const router = useRouter()` | `const navigate = useNavigate()`<br>`const params = useParams()`<br>`const location = useLocation()` |
| `router.push('/path')` | `navigate('/path')` |
| `router.replace('/path')` | `navigate('/path', { replace: true })` |
| `router.query` | `params` |
| `router.pathname` | `location.pathname` |
| `router.asPath` | `location.pathname + location.search + location.hash` |

## Pre-Migration Checklist

1. **Backup your code** - Commit all changes before running the migration
2. **Install dependencies** - Ensure you have react-router-dom installed:
   ```bash
   npm install react-router-dom
   ```
3. **Review custom components** - Ensure `/src/components/Image` and `/src/components/Link` exist

## Running the Migration

1. **Choose your script**:
   - Use the basic script for simple projects
   - Use the advanced script for complex codebases with TypeScript, JSX, etc.

2. **Run the migration**:
   ```bash
   # Basic migration
   node migrate-nextjs-imports.js
   
   # Advanced migration (recommended)
   node migrate-nextjs-imports-advanced.js
   ```

3. **Review the output**:
   - Check the console for statistics
   - Review `migration-report.md` (advanced script only)
   - Look for TODO comments in modified files

## Post-Migration Steps

1. **Search for TODO comments**:
   ```bash
   grep -r "TODO:" src/ apps/ pages/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"
   ```

2. **Test routing functionality**:
   - Test all navigation links
   - Verify dynamic routes work correctly
   - Check query parameter handling
   - Test programmatic navigation

3. **Handle Next.js specific features manually**:
   - Server-side routing (getServerSideProps, getStaticProps)
   - API routes
   - Middleware
   - Custom _app.js or _document.js logic
   - Image optimization features specific to Next.js

4. **Update your routing setup**:
   - Ensure your React Router is properly configured
   - Update route definitions to match your Next.js pages structure
   - Handle catch-all routes and dynamic segments

## Common Issues and Solutions

### Issue: Import not found errors
**Solution**: Ensure the custom Image and Link components exist at the specified paths

### Issue: Navigation not working
**Solution**: Verify React Router is properly set up in your app with BrowserRouter/Routes

### Issue: Query parameters not accessible
**Solution**: Use `useSearchParams` hook from react-router-dom for search params

### Issue: Dynamic imports failing
**Solution**: Update webpack configuration to handle the new import paths

## Manual Migrations Required

Some Next.js features require manual migration:

1. **API Routes** - Move to a separate backend or use a framework like Express
2. **getServerSideProps/getStaticProps** - Convert to client-side data fetching
3. **Middleware** - Implement using React Router loaders or custom logic
4. **Image Optimization** - Implement lazy loading and optimization in the custom Image component
5. **Head Management** - Use react-helmet-async or similar for meta tags

## Rollback

If you need to rollback:
1. Revert the changes using git: `git checkout .`
2. Or restore from your backup branch

## Support

For issues or questions:
1. Check the TODO comments in your code
2. Review the migration report
3. Check React Router documentation for routing patterns
4. Test thoroughly in development before deploying