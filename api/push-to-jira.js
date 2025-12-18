// Vercel Serverless Function for Jira Integration
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
      return res.status(400).json({ error: urlValidation.error });
    }

    console.log('Pushing ticket to Jira:', projectKey);
    if (attachments && attachments.length > 0) {
      console.log(`${attachments.length} attachment(s) included`);
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
    
    console.log('Full Jira Payload:', JSON.stringify(jiraPayload, null, 2));

    // Make request to Jira API (cleanJiraUrl already defined above)
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
    
    return res.status(200).json({
      key: data.key,
      id: data.id,
      self: data.self,
      url: `${cleanJiraUrl}/browse/${data.key}`
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

