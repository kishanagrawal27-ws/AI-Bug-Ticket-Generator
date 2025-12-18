# Netlify Deployment Setup Guide

## 🚀 Quick Setup

### Step 1: Set Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site Settings** → **Environment Variables**
3. Add the following variables:

```
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE
ALLOWED_ORIGINS=https://ai-bug-ticket-generator.netlify.app
NODE_ENV=production
```

**Important**: Replace the domain in `ALLOWED_ORIGINS` with your actual Netlify domain.

### Step 2: Deploy

```bash
# Build and deploy to production
npm run netlify:deploy

# Or use Netlify CLI
netlify deploy --prod
```

### Step 3: Verify

1. Open your deployed site
2. Check browser console for errors
3. Test the "Test Connection" button with Jira credentials
4. Generate a ticket and push to Jira

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Environment variables are set in Netlify dashboard
- [ ] Site loads without errors
- [ ] Ticket generation works
- [ ] Jira connection test works
- [ ] Push to Jira works
- [ ] Security headers are present (check with curl or browser dev tools)
- [ ] HTTPS is enforced (try accessing via HTTP)

---

## 🔒 Security Headers Verification

Check if security headers are working:

```bash
curl -I https://your-domain.netlify.app
```

You should see:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: ...
```

---

## 🐛 Troubleshooting

### Issue: "API key not set" error

**Solution**: 
1. Check environment variables in Netlify dashboard
2. Ensure `ANTHROPIC_API_KEY` is set
3. Redeploy the site after adding variables

### Issue: CORS errors

**Solution**:
1. Check `ALLOWED_ORIGINS` environment variable
2. Ensure your Netlify domain is included
3. Check browser console for the exact origin being blocked

### Issue: Rate limiting too aggressive

**Solution**:
Edit the rate limit values in:
- `netlify/functions/generate-ticket.js` (line ~10)
- `netlify/functions/push-to-jira.js` (line ~10)
- `netlify/functions/test-jira.js` (line ~10)

---

## 📊 Monitoring

Monitor your Netlify functions:
1. Go to **Functions** tab in Netlify dashboard
2. Check function logs for errors
3. Monitor invocation counts
4. Check for rate limit hits (429 errors)

---

**Last Updated**: December 2024

