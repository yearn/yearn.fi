# OG Image API Endpoint

The OG image generation API endpoint from Next.js has been extracted and needs to be deployed separately.

## Options:

1. **Vercel Edge Functions** - Deploy the `/pages/api/og/[chainID]/[address].tsx` file as a standalone Edge Function
2. **Cloudflare Workers** - Convert to a Cloudflare Worker for edge deployment
3. **Express Server** - Run as a separate Express/Node.js service
4. **Keep in Next.js** - Deploy a minimal Next.js app just for the API route

## Current Implementation

The OG image generation endpoint is located at `/pages/api/og/[chainID]/[address].tsx` and:
- Uses Edge Runtime for performance
- Generates dynamic Open Graph images for vault pages
- Fetches vault data from yDaemon API
- Supports special handling for Katana and yBOLD vaults

## Environment Variables Required

```
VITE_YDAEMON_BASE_URI=
VITE_KATANA_APR_SERVICE_API=
VITE_BASE_YEARN_ASSETS_URI=
```

## Deployment Instructions

### Option 1: Vercel Edge Functions (Recommended)

1. Create a new Vercel project for the API
2. Copy the API route to `api/og/[chainID]/[address].ts`
3. Update imports to use regular fetch instead of Next.js specific imports
4. Deploy to Vercel

### Option 2: Cloudflare Workers

1. Create a new Workers project
2. Convert the handler to Cloudflare Workers format
3. Use Cloudflare's image generation capabilities
4. Deploy to Cloudflare

The main application will need to update the OG image URLs to point to the new API endpoint location.