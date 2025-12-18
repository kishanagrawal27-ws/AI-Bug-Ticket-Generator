// Netlify Serverless Function for API proxy
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['https://ai-bug-ticket-generator.netlify.app'];

// Simple rate limiting (in-memory, resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15; // 15 requests per minute per IP

exports.handler = async (event, context) => {
  // Rate limiting
  const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  
  if (rateLimitMap.has(ip)) {
    const limit = rateLimitMap.get(ip);
    if (now < limit.resetTime) {
      if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
        return {
          statusCode: 429,
          headers: {
            'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Too many requests. Please try again in a minute.' })
        };
      }
      limit.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }
  } else {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  }
  // Get origin from request
  const origin = event.headers.origin || event.headers.Origin;
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);
  
  // Enable CORS with restricted origins
  const headers = {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Validate API key is set
  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Server configuration error: API key not set' 
      })
    };
  }

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { messages } = JSON.parse(event.body);

    if (!messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid request: messages array is required' 
        })
      };
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
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: errorData.error?.message || 'Failed to generate ticket' 
        })
      };
    }

    const data = await response.json();
    console.log('Ticket generated successfully');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Server error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error' 
      })
    };
  }
};

