import { Handler } from '@netlify/functions';
import { testDbConnection } from '../../src/lib/db';

export const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Test database connection
    const dbHealthy = await testDbConnection();
    
    // Check required environment variables
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    const netlifyConfigured = !!(process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID);
    
    const healthy = dbHealthy && openaiConfigured && netlifyConfigured;
    
    return {
      statusCode: healthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ok: healthy,
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealthy,
          openai: openaiConfigured,
          netlify: netlifyConfigured,
        }
      }),
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ok: false,
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }),
    };
  }
};
