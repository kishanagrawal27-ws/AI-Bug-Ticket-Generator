# How to Set Environment Variables in Vercel

## Method 1: Through Vercel Dashboard (Recommended)

### Steps:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables** (in the left sidebar)
4. You'll see the Environment Variables interface with "Key" and "Value" columns

### Adding ANTHROPIC_API_KEY:

1. In the **Key** field, enter: `ANTHROPIC_API_KEY`
2. In the **Value** field, enter: Your actual Anthropic API key (starts with `sk-ant-...`)
3. Select the environments where you want this variable:
   - ✅ **Production** (for live site)
   - ✅ **Preview** (for preview deployments)
   - ✅ **Development** (for local development with `vercel dev`)
4. Click **Save** or the **Add** button

### Variables to Add:

```
Key: ANTHROPIC_API_KEY
Value: YOUR_ANTHROPIC_API_KEY_HERE
Environments: Production, Preview, Development
```

### Optional: Add ALLOWED_ORIGINS

If you need to restrict CORS origins:

```
Key: ALLOWED_ORIGINS
Value: https://your-vercel-domain.vercel.app
Environments: Production, Preview
```

---

## Method 2: Using Vercel CLI

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Link Your Project
```bash
cd "/Users/kishanagrawal/Documents/WS-Automation/Kishan Script copy"
vercel link
```

### Step 4: Set Environment Variables

**For Production:**
```bash
vercel env add ANTHROPIC_API_KEY production
# When prompted, paste your API key
```

**For Preview:**
```bash
vercel env add ANTHROPIC_API_KEY preview
# When prompted, paste your API key
```

**For Development:**
```bash
vercel env add ANTHROPIC_API_KEY development
# When prompted, paste your API key
```

### Step 5: Verify Variables
```bash
vercel env ls
```

### Step 6: Redeploy
After adding environment variables, you need to redeploy:
```bash
vercel --prod
```

Or trigger a new deployment from the Vercel dashboard.

---

## Method 3: Import from .env File

In the Vercel dashboard:

1. Go to **Settings** → **Environment Variables**
2. Click **"Import .env"** button
3. Paste your `.env` file contents (or upload the file)
4. Select which environments to apply to
5. Click **Import**

**Example .env content:**
```
ANTHROPIC_API_KEY=your-actual-api-key-here
ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
NODE_ENV=production
```

---

## 🔍 Verifying Environment Variables

### Check in Vercel Dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. You should see `ANTHROPIC_API_KEY` listed with the environments it's enabled for

### Check via CLI:
```bash
vercel env ls
```

### Test in Your Code:
Your serverless function in `api/generate-ticket.js` will automatically have access to `process.env.ANTHROPIC_API_KEY` once it's set.

---

## ⚠️ Important Notes

1. **After adding variables, you MUST redeploy** for them to take effect
2. Environment variables are encrypted and stored securely by Vercel
3. Never commit your actual API keys to Git (they're already in `.gitignore`)
4. Each environment (Production/Preview/Development) can have different values if needed

---

## 🚀 Quick Setup Checklist

- [ ] Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- [ ] Click "Add More" or use the existing input fields
- [ ] Enter `ANTHROPIC_API_KEY` as the Key
- [ ] Enter your actual API key as the Value
- [ ] Select Production, Preview, and Development environments
- [ ] Click Save
- [ ] Redeploy your project (or wait for next deployment)

---

## 🐛 Troubleshooting

### Issue: "API key not set" error after deployment

**Solution:**
1. Verify the variable is set in Vercel dashboard
2. Check that you selected the correct environment (Production/Preview)
3. **Redeploy** your project after adding the variable
4. Check function logs in Vercel dashboard for errors

### Issue: Variable works locally but not in production

**Solution:**
1. Make sure you added the variable for **Production** environment
2. Redeploy your production deployment
3. Check that the variable name matches exactly: `ANTHROPIC_API_KEY`

### Issue: Can't find Environment Variables in dashboard

**Solution:**
- Make sure you're in the correct project
- Look for **Settings** in the top navigation or left sidebar
- The direct URL format: `https://vercel.com/[your-team]/[your-project]/settings/environment-variables`

---

**Last Updated**: December 2024

