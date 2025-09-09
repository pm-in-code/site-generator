import { Handler } from '@netlify/functions';
import { getLongUrl } from '../../src/lib/db';

export const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Extract slug from path
    const slug = event.path.replace('/s/', '').replace('/.netlify/functions/redirect', '');
    
    // Validate slug format (alphanumeric, 6-8 chars)
    if (!/^[a-z0-9]{6,8}$/.test(slug)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid slug format' }),
      };
    }
    
    // Look up the long URL
    const longUrl = await getLongUrl(slug);
    
    if (!longUrl) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Short link not found' }),
      };
    }
    
    // Redirect to the long URL
    return {
      statusCode: 302,
      headers: {
        'Location': longUrl,
      },
      body: '',
    };
    
  } catch (error) {
    console.error('Error in redirect function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
