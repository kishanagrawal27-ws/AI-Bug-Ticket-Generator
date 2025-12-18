import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// API Key from environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ FATAL ERROR: ANTHROPIC_API_KEY is not set in environment variables');
  console.error('Please create a .env file with ANTHROPIC_API_KEY=your-key-here');
  process.exit(1);
}

// CORS whitelist for security - from environment or defaults
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://ai-bug-ticket-generator.netlify.app'
    ];

// Jira URL validation - only allow Atlassian domains
const validateJiraUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    // Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Jira URL must use HTTPS' };
    }
    // Only allow atlassian.net domains
    if (!parsedUrl.hostname.endsWith('.atlassian.net')) {
      return { valid: false, error: 'Only Atlassian-hosted Jira instances are allowed' };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid Jira URL format' };
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin only in development (for testing tools)
    if (!origin && NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, require origin header
    if (!origin && NODE_ENV === 'production') {
      return callback(new Error('Origin header required'));
    }
    
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      if (NODE_ENV === 'development') {
        console.log('🚫 Blocked request from:', origin);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

// Simple rate limiting (in-memory)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // 20 requests per minute

const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const limit = rateLimitMap.get(ip);
  
  if (now > limit.resetTime) {
    // Reset window
    limit.count = 1;
    limit.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
    if (NODE_ENV === 'development') {
      console.log(`🚫 Rate limit exceeded for IP: ${ip}`);
    }
    return res.status(429).json({
      error: 'Too many requests. Please try again in a minute.'
    });
  }
  
  limit.count++;
  next();
};

// Security headers middleware
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://api.anthropic.com https://*.atlassian.net; " +
    "frame-ancestors 'none';"
  );
  
  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HTTPS enforcement in production
  if (NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  
  next();
});

// Middleware
app.use(cors(corsOptions));
app.use(rateLimit); // Apply rate limiting to all routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime + 60000) {
      rateLimitMap.delete(ip);
    }
  }
}, 300000);

// Error handling middleware for payload too large
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    console.error('⚠️ Payload too large error');
    return res.status(413).json({
      error: 'The file you uploaded is too large. Please remove it from the UI (click the Clear button) and then push the ticket to Jira without the attachment.'
    });
  }
  next(err);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Proxy endpoint for Anthropic API
app.post('/api/generate-ticket', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array is required' 
      });
    }

    console.log('Generating ticket with Anthropic API...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({ 
        error: errorData.error?.message || 'Failed to generate ticket' 
      });
    }

    const data = await response.json();
    console.log('Ticket generated successfully');
    
    res.json(data);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
});

// Test Jira connection endpoint
app.post('/api/test-jira', async (req, res) => {
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
      return res.status(400).json({ 
        error: urlValidation.error 
      });
    }

    if (NODE_ENV === 'development') {
      console.log('Testing Jira connection for:', email);
    }

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
    
    res.json({
      success: true,
      displayName: data.displayName,
      emailAddress: data.emailAddress,
      accountId: data.accountId
    });
  } catch (error) {
    console.error('Server error during Jira connection test:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
});

// Proxy endpoint for Jira API
app.post('/api/push-to-jira', async (req, res) => {
  try {
    const { jiraUrl, email, apiToken, projectKey, fields, customFields, attachments } = req.body;

    // Validate required fields
    if (!jiraUrl || !email || !apiToken || !projectKey || !fields) {
      return res.status(400).json({ 
        error: 'Missing required fields: jiraUrl, email, apiToken, projectKey, fields' 
      });
    }

    // Validate Jira URL
    const urlValidation = validateJiraUrl(jiraUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({ 
        error: urlValidation.error 
      });
    }

    if (NODE_ENV === 'development') {
      console.log('Pushing ticket to Jira:', projectKey);
      console.log('Custom Fields Received:', JSON.stringify(customFields, null, 2));
      if (attachments && attachments.length > 0) {
        console.log(`${attachments.length} attachment(s) included:`, attachments.map(a => a.filename).join(', '));
      }
    }

    // Create Basic Auth token
    const authString = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const cleanJiraUrl = jiraUrl.replace(/\/$/, ''); // Remove trailing slash

    // Helper function to get Engineering Team ID from value by querying create metadata
    const getEngineeringTeamId = async (teamValue) => {
      try {
        // Query Jira API create metadata to get field options with IDs
        const metadataResponse = await fetch(`${cleanJiraUrl}/rest/api/2/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=Bug&expand=projects.issuetypes.fields`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json'
          }
        });

        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          // Navigate through metadata to find customfield_11737
          if (metadata.projects && metadata.projects[0] && 
              metadata.projects[0].issuetypes && metadata.projects[0].issuetypes[0] &&
              metadata.projects[0].issuetypes[0].fields && 
              metadata.projects[0].issuetypes[0].fields.customfield_11737) {
            const field = metadata.projects[0].issuetypes[0].fields.customfield_11737;
            if (field.allowedValues) {
              const matchingOption = field.allowedValues.find(opt => 
                opt.value === teamValue || opt.name === teamValue
              );
              if (matchingOption && matchingOption.id) {
                return matchingOption.id;
              }
            }
          }
        }
      } catch (error) {
        console.log('Warning: Could not fetch Engineering Team field metadata:', error.message);
      }
      return null;
    };

    // Build Jira description (custom fields are sent separately, not in description)
    const jiraDescription = `*Description:*\n${fields.description}\n\n` +
      `*Steps to Reproduce:*\n${fields.steps}\n\n` +
      `*Expected Behaviour:*\n${fields.expected}\n\n` +
      `*Actual Behaviour:*\n${fields.actual}\n\n` +
      `*Impact:*\n${fields.impact}\n\n` +
      `*Environment:*\n${fields.environment}`;

    // Prepare Jira payload
    const jiraPayload = {
      fields: {
        project: {
          key: projectKey
        },
        summary: fields.title,
        description: jiraDescription,
        issuetype: {
          name: 'Bug'
        }
      }
    };
    
    // Add priority if provided (use ID and name format as shown in user's curl example)
    // Always set priority - if not provided, default to P3 (Medium)
    console.log('=== BACKEND PRIORITY DEBUG ===');
    console.log('Received fields.priorityId:', fields.priorityId);
    console.log('Received fields.priorityName:', fields.priorityName);
    console.log('Type of priorityId:', typeof fields.priorityId);
    console.log('Full fields object:', JSON.stringify(fields, null, 2));
    
    const priorityId = fields.priorityId || '3';
    const priorityName = fields.priorityName || 'P3';
    
    console.log('Final priorityId being used:', priorityId);
    console.log('Final priorityName being used:', priorityName);
    
    jiraPayload.fields.priority = { 
      id: priorityId,
      name: priorityName
    };
    console.log('Setting Priority in Jira payload:', JSON.stringify(jiraPayload.fields.priority, null, 2));
    console.log('=== END BACKEND PRIORITY DEBUG ===');
    
    // Add custom fields if provided
    if (customFields) {
      // Instance (customfield_11888) - object with value (not name)
      if (customFields.instance) {
        jiraPayload.fields.customfield_11888 = { value: customFields.instance };
        console.log('Setting Instance:', customFields.instance);
      }
      
      // Product Line (customfield_11924) - object with value (not name)
      if (customFields.productLine) {
        jiraPayload.fields.customfield_11924 = { value: customFields.productLine };
        console.log('Setting Product Line:', customFields.productLine);
      }
      
      // Component (standard field - array format)
      if (customFields.component) {
        jiraPayload.fields.components = [{ name: customFields.component }];
      }
      
      // Found Version (customfield_11744) - object format with name (WORKING!)
      if (customFields.foundVersion) {
        jiraPayload.fields.customfield_11744 = { name: customFields.foundVersion };
      }
      
      // Engineering Team (customfield_11737) - needs both id and value (from curl example)
      if (customFields.engineeringTeam) {
        const engTeamValue = String(customFields.engineeringTeam).trim();
        if (engTeamValue) {
          // Get the ID for this Engineering Team value
          const engTeamId = await getEngineeringTeamId(engTeamValue);
          if (engTeamId) {
            jiraPayload.fields.customfield_11737 = { id: engTeamId, value: engTeamValue };
            console.log('✓ Setting Engineering Team (id + value format):', engTeamValue, 'ID:', engTeamId);
          } else {
            // Fallback: try with just value (some Jira instances might accept it)
            jiraPayload.fields.customfield_11737 = { value: engTeamValue };
            console.log('⚠ Setting Engineering Team (value only, ID not found):', engTeamValue);
          }
          console.log('✓ Engineering Team field structure:', JSON.stringify(jiraPayload.fields.customfield_11737));
        } else {
          console.log('✗ ERROR: Engineering Team is empty string after trim!');
        }
      } else {
        console.log('✗ ERROR: Engineering Team is missing from customFields!');
        console.log('✗ CustomFields keys:', Object.keys(customFields || {}));
        console.log('✗ CustomFields.engineeringTeam value:', customFields.engineeringTeam);
        console.log('✗ Full CustomFields:', JSON.stringify(customFields, null, 2));
      }
    }
    
    // Always log payload for debugging
    console.log('=== JIRA PAYLOAD DEBUG ===');
    console.log('Custom Fields in Payload:');
    console.log('  - customfield_11888 (Instance):', JSON.stringify(jiraPayload.fields.customfield_11888));
    console.log('  - customfield_11924 (Product Line):', JSON.stringify(jiraPayload.fields.customfield_11924));
    console.log('  - customfield_11744 (Found Version):', JSON.stringify(jiraPayload.fields.customfield_11744));
    console.log('  - customfield_11737 (Engineering Team):', JSON.stringify(jiraPayload.fields.customfield_11737));
    console.log('  - components:', JSON.stringify(jiraPayload.fields.components));
    if (NODE_ENV === 'development') {
      console.log('Full Jira Payload:', JSON.stringify(jiraPayload, null, 2));
    }
    console.log('=== END DEBUG ===');

    // Make request to Jira API
    const response = await fetch(`${cleanJiraUrl}/rest/api/2/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(jiraPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jira API error:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        return res.status(response.status).json({ 
          error: `Jira API returned non-JSON response: ${errorText.substring(0, 200)}`
        });
      }
      
      // Extract meaningful error message
      let errorMessage = 'Failed to create Jira ticket';
      
      if (errorData.errorMessages && Array.isArray(errorData.errorMessages) && errorData.errorMessages.length > 0) {
        errorMessage = errorData.errorMessages.join(', ');
      } else if (errorData.errors && typeof errorData.errors === 'object') {
        const errorFields = Object.entries(errorData.errors).map(([field, msg]) => `${field}: ${msg}`);
        errorMessage = errorFields.join(', ');
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
      
      console.error('Processed error message:', errorMessage);
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorData
      });
    }

    const data = await response.json();
    console.log('Jira ticket created:', data.key);
    
    // Upload attachments if provided (multiple files)
    if (attachments && attachments.length > 0) {
      try {
        console.log(`Uploading ${attachments.length} attachment(s) to Jira ticket:`, data.key);
        
        const FormData = (await import('form-data')).default;
        
        // Upload each attachment
        for (let i = 0; i < attachments.length; i++) {
          const attachment = attachments[i];
          
          try {
            // Convert base64 to buffer
            const base64Data = attachment.data.split(',')[1] || attachment.data;
            const fileBuffer = Buffer.from(base64Data, 'base64');
            
            // Create form data for this file
            const formData = new FormData();
            formData.append('file', fileBuffer, {
              filename: attachment.filename,
              contentType: attachment.contentType
            });
            
            // Upload attachment to Jira
            const attachmentResponse = await fetch(`${cleanJiraUrl}/rest/api/2/issue/${data.key}/attachments`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${authString}`,
                'X-Atlassian-Token': 'no-check',
                ...formData.getHeaders()
              },
              body: formData
            });
            
            if (attachmentResponse.ok) {
              console.log(`✅ Attachment ${i + 1}/${attachments.length} uploaded: ${attachment.filename}`);
            } else {
              const attachmentError = await attachmentResponse.text();
              console.error(`⚠️ Failed to upload attachment ${i + 1}:`, attachmentError);
              
              // Handle 413 Payload Too Large specifically
              if (attachmentResponse.status === 413) {
                return res.status(413).json({
                  error: `One or more files are too large for Jira. Please remove large files and try again.`
                });
              }
            }
          } catch (singleFileError) {
            console.error(`⚠️ Error uploading file ${i + 1} (${attachment.filename}):`, singleFileError.message);
            // Continue with other files
          }
        }
        
        console.log('✅ All attachments processed');
      } catch (attachmentError) {
        console.error('⚠️ Error processing attachments:', attachmentError.message);
        // Don't fail the whole request if attachments fail
      }
    }
    
    res.json({
      key: data.key,
      id: data.id,
      self: data.self,
      url: `${cleanJiraUrl}/browse/${data.key}`
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/generate-ticket`);
  console.log(`🔗 Jira endpoint: http://localhost:${PORT}/api/push-to-jira`);
  console.log(`🧪 Test Jira endpoint: http://localhost:${PORT}/api/test-jira`);
});

