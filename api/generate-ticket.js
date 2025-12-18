// Vercel Serverless Function for API proxy
// Clean and trim the API key to remove any whitespace/newlines
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.trim().replace(/\s+/g, '') : null;

export default async function handler(req, res) {
  // Always set Content-Type to JSON
  res.setHeader('Content-Type', 'application/json');
  
  // Validate API key is set
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error: API key not set. Please configure ANTHROPIC_API_KEY in Vercel environment variables.' 
    });
  }
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array is required' 
      });
    }

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
      return res.status(response.status).json({ 
        error: errorData.error?.message || 'Failed to generate ticket' 
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

