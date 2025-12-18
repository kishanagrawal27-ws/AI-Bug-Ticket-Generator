// Vercel Serverless Function for Testing Jira Connection
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*']; // Allow all origins in Vercel by default, can be restricted

// Simple rate limiting (in-memory, resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP

// Jira URL validation
const validateJiraUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Jira URL must use HTTPS' };
    }
    if (!parsedUrl.hostname.endsWith('.atlassian.net')) {
      return { valid: false, error: 'Only Atlassian-hosted Jira instances are allowed' };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid Jira URL format' };
  }
};

export default async function handler(req, res) {
  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const now = Date.now();
  
  if (rateLimitMap.has(ip)) {
    const limit = rateLimitMap.get(ip);
    if (now < limit.resetTime) {
      if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
      }
      limit.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }
  } else {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  }

  // Get origin from request
  const origin = req.headers.origin || req.headers.referer;
  const isAllowedOrigin = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
  
  // Enable CORS with restricted origins
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : ALLOWED_ORIGINS[0] || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jiraUrl, email, apiToken } = req.body;

    // Validate required fields
    if (!jiraUrl || !email || !apiToken) {
      return res.status(400).json({ 
        error: 'Missing required fields: jiraUrl, email, apiToken' 
      });
    }

    // Validate Jira URL
    const urlValidation = validateJiraUrl(jiraUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({ error: urlValidation.error });
    }

    console.log('Testing Jira connection for:', email);

    // Create Basic Auth token
    const authString = Buffer.from(`${email}:${apiToken}`).toString('base64');

    // Test connection by calling /myself endpoint
    const cleanJiraUrl = jiraUrl.replace(/\/$/, ''); // Remove trailing slash
    const response = await fetch(`${cleanJiraUrl}/rest/api/3/myself`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jira connection test failed:', errorText);
      
      return res.status(response.status).json({ 
        error: response.status === 401 
          ? 'Authentication failed. Please check your email and API token.' 
          : response.status === 403
          ? 'Access denied. Your account may not have permission.'
          : response.status === 404
          ? 'Jira instance not found. Please check your URL.'
          : 'Connection test failed'
      });
    }

    const data = await response.json();
    console.log('Jira connection test successful for:', data.displayName || data.emailAddress);
    
    return res.status(200).json({
      success: true,
      displayName: data.displayName,
      emailAddress: data.emailAddress,
      accountId: data.accountId
    });
  } catch (error) {
    console.error('Server error during Jira connection test:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

