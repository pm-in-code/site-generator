// Simple shared storage for short links
let linkStorage = new Map();

// Use shared storage from global
if (global.linkStorage) {
  linkStorage = global.linkStorage;
} else {
  global.linkStorage = linkStorage;
}

// Function to get URL by slug
function getUrlBySlug(slug) {
  const link = linkStorage.get(slug);
  if (link) {
    link.clicks++;
    return link.url;
  }
  return null;
}

// Netlify Function for handling redirects
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Extract slug from path
    const path = event.path || '';
    const slug = path.split('/').pop(); // Get last part of path
    
    console.log('Redirect request for slug:', slug);
    console.log('Current storage keys:', Array.from(linkStorage.keys()));
    
    // Validate slug format
    if (!slug || !/^[a-z0-9]{6,8}$/.test(slug)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <head><title>Invalid Link</title></head>
            <body>
              <h1>Invalid Link</h1>
              <p>This short link format is invalid.</p>
              <a href="https://prompt2site-demo.netlify.app">← Back to BRAYN - Prompt2Site</a>
            </body>
          </html>
        `,
      };
    }
    
    // Look up the URL
    const longUrl = getUrlBySlug(slug);
    
    if (!longUrl) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: `
          <html>
            <head><title>Link Not Found</title></head>
            <body>
              <h1>Link Not Found</h1>
              <p>This short link doesn't exist or has expired.</p>
              <a href="https://prompt2site-demo.netlify.app">← Back to BRAYN - Prompt2Site</a>
            </body>
          </html>
        `,
      };
    }
    
    // Redirect to the generated site
    return {
      statusCode: 302,
      headers: {
        'Location': longUrl,
        'Cache-Control': 'no-cache',
      },
      body: '',
    };
    
  } catch (error) {
    console.error('Error in redirect function:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Server Error</h1>
            <p>Something went wrong. Please try again.</p>
            <a href="https://prompt2site-demo.netlify.app">← Back to BRAYN - Prompt2Site</a>
          </body>
        </html>
      `,
    };
  }
};
