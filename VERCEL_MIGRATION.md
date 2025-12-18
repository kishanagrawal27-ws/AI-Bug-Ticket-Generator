# Vercel Migration Guide

## ✅ Changes Made for Vercel Compatibility

### 1. Created Vercel API Functions
- **`api/generate-ticket.js`** - Already existed, handles ticket generation
- **`api/push-to-jira.js`** - NEW: Vercel version of Jira push functionality
- **`api/test-jira.js`** - NEW: Vercel version of Jira connection testing

### 2. Updated Frontend API Endpoint Detection
- Modified `src/App.jsx` to automatically detect deployment platform
- Added `getApiEndpoint()` helper function that:
  - Checks for `VITE_API_URL` environment variable (highest priority)
  - Uses localhost for development
  - Detects Vercel vs Netlify by hostname in production
  - Falls back to Netlify if detection fails

### 3. Updated Vercel Configuration
- Removed redundant rewrite rule from `vercel.json`
- Vercel automatically serves files in `/api` folder as serverless functions

## 🔍 How Platform Detection Works

The frontend now automatically detects the platform:

```javascript
// Vercel detection
if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) {
  return `/api/${functionName}`;  // Vercel path
} else {
  return `/.netlify/functions/${functionName}`;  // Netlify path
}
```

## 📋 API Endpoints

### Production (Vercel)
- Ticket Generation: `/api/generate-ticket`
- Test Jira Connection: `/api/test-jira`
- Push to Jira: `/api/push-to-jira`

### Production (Netlify)
- Ticket Generation: `/.netlify/functions/generate-ticket`
- Test Jira Connection: `/.netlify/functions/test-jira`
- Push to Jira: `/.netlify/functions/push-to-jira`

### Development
- All endpoints: `http://localhost:3001/api/{function-name}`

## 🔧 Environment Variables Required in Vercel

Make sure to set these in Vercel Dashboard → Settings → Environment Variables:

1. **ANTHROPIC_API_KEY** (Required)
   - Your Anthropic API key for ticket generation
   - Set for: Production, Preview, Development

2. **ALLOWED_ORIGINS** (Optional)
   - Comma-separated list of allowed CORS origins
   - Example: `https://your-app.vercel.app,https://your-custom-domain.com`
   - Defaults to `*` (allow all) if not set

## 🚀 Deployment Steps

1. **Set Environment Variables** in Vercel Dashboard
   - Go to your project → Settings → Environment Variables
   - Add `ANTHROPIC_API_KEY` with your actual key
   - Optionally add `ALLOWED_ORIGINS`

2. **Deploy to Vercel**
   - Push your code to GitHub (already done)
   - Vercel will automatically deploy
   - Or manually trigger deployment from Vercel dashboard

3. **Verify Deployment**
   - Check that all API endpoints are accessible
   - Test ticket generation
   - Test Jira connection
   - Test pushing tickets to Jira

## 🐛 Troubleshooting

### Issue: "Unexpected token 'T', "The page c"... is not valid JSON"

**Cause**: Frontend was calling Netlify endpoints on Vercel, getting 404 HTML page instead of JSON.

**Solution**: ✅ Fixed - Frontend now auto-detects platform and uses correct endpoints.

### Issue: API functions return 500 errors

**Possible Causes**:
1. `ANTHROPIC_API_KEY` not set in Vercel environment variables
2. Environment variable not applied to the correct environment (Production/Preview)
3. Need to redeploy after adding environment variables

**Solution**:
1. Verify environment variables in Vercel dashboard
2. Make sure they're set for the correct environment
3. Redeploy your application

### Issue: CORS errors

**Solution**: 
- Set `ALLOWED_ORIGINS` environment variable in Vercel
- Include your Vercel domain: `https://your-app.vercel.app`
- Or leave it unset to allow all origins (default)

## ✅ Verification Checklist

After deployment, verify:

- [ ] Environment variables are set in Vercel dashboard
- [ ] Site loads without errors
- [ ] Ticket generation works (no JSON parsing errors)
- [ ] Jira connection test works
- [ ] Push to Jira works
- [ ] All API endpoints return JSON (not HTML error pages)

## 📝 Differences from Netlify

| Feature | Netlify | Vercel |
|---------|---------|--------|
| Function Path | `/.netlify/functions/` | `/api/` |
| Function Format | CommonJS (`.cjs`) | ES Modules (`.js`) |
| Handler Export | `exports.handler` | `export default function handler` |
| Request Object | `event` | `req` |
| Response Object | Return object | `res.status().json()` |
| CORS Headers | In response object | `res.setHeader()` |

## 🔄 Backward Compatibility

The code maintains backward compatibility:
- Still works on Netlify (uses Netlify endpoints)
- Still works locally (uses localhost:3001)
- Automatically detects and uses correct endpoints

---

**Last Updated**: December 2024

