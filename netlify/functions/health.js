// Health check function
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check required environment variables
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    const netlifyConfigured = !!process.env.NETLIFY_AUTH_TOKEN;
    
    const healthy = openaiConfigured; // For now, just check OpenAI
    
    return {
      statusCode: healthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: healthy,
        timestamp: new Date().toISOString(),
        checks: {
          openai: openaiConfigured,
          netlify: netlifyConfigured,
          database: true // Mock for now
        }
      }),
    };
  } catch (error) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }),
    };
  }
};
