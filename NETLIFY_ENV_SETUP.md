# How to Set Environment Variables in Netlify

## Method 1: Through Netlify UI (Current Version)

### Steps:
1. Go to https://app.netlify.com
2. Click on your site name
3. Look for one of these options in the top navigation:
   - **"Site configuration"** (newer UI) OR
   - **"Site settings"** (older UI)
4. In the left sidebar, look for:
   - **"Environment variables"** OR
   - **"Build & deploy"** → **"Environment"** → **"Environment variables"**
5. Click **"Add a variable"** or **"Add environment variable"**

### Variables to Add:
```
Key: ANTHROPIC_API_KEY
Value: YOUR_ANTHROPIC_API_KEY_HERE

Key: ALLOWED_ORIGINS  
Value: https://YOUR-SITE-NAME.netlify.app

Key: NODE_ENV
Value: production
```

---

## Method 2: Using Netlify CLI (Easier!)

If you can't find the UI option, use the CLI:

### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Step 2: Login to Netlify
```bash
netlify login
```

### Step 3: Link Your Site
```bash
cd "/Users/kishanagrawal/Documents/WS-Automation/Kishan Script"
netlify link
```

### Step 4: Set Environment Variables
```bash
netlify env:set ANTHROPIC_API_KEY "YOUR_ANTHROPIC_API_KEY_HERE"

netlify env:set ALLOWED_ORIGINS "https://YOUR-SITE-NAME.netlify.app"

netlify env:set NODE_ENV "production"
```

### Step 5: Verify Variables Were Set
```bash
netlify env:list
```

### Step 6: Redeploy
```bash
netlify deploy --prod
```

---

## Method 3: Using netlify.toml File

Add this to your netlify.toml file (BUT DON'T COMMIT IT TO GIT!):

```toml
[context.production.environment]
  ANTHROPIC_API_KEY = "your-api-key-here"
  ALLOWED_ORIGINS = "https://your-site.netlify.app"
  NODE_ENV = "production"
```

⚠️ **WARNING**: This method exposes your API key in the repo. Only use temporarily!

---

## Quick Check: Is Your Site Linked?

Run this to see your site info:
```bash
netlify status
```

If not linked, run:
```bash
netlify link
```

---

## Troubleshooting

### Can't find Environment Variables in UI?
Try these URLs directly (replace YOUR-SITE-ID):
- https://app.netlify.com/sites/YOUR-SITE-ID/settings/env
- https://app.netlify.com/sites/YOUR-SITE-ID/configuration/env

### Still Can't Find It?
The Netlify UI has changed recently. Look for:
- "Site configuration" (top tab)
- Then "Environment variables" (left sidebar)

---

## Which Method Should You Use?

**Recommended**: Method 2 (Netlify CLI) - It's the most reliable and straightforward.

Run these commands now:
```bash
cd "/Users/kishanagrawal/Documents/WS-Automation/Kishan Script"
netlify login
netlify link
netlify env:set ANTHROPIC_API_KEY "YOUR_ANTHROPIC_API_KEY_HERE"
netlify deploy --prod
```

That's it! ✅
