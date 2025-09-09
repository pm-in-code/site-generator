// Simple shared storage for short links
let linkStorage = new Map();

// Share storage with redirect function
if (global.linkStorage) {
  linkStorage = global.linkStorage;
} else {
  global.linkStorage = linkStorage;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { slug, url } = JSON.parse(event.body || '{}');
    
    if (!slug || !url) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing slug or url' }),
      };
    }

    // Store the mapping
    linkStorage.set(slug, {
      url: url,
      createdAt: new Date(),
      clicks: 0
    });

    console.log('Stored link mapping:', slug, '→', url.substring(0, 100) + '...');
    console.log('Total stored links:', linkStorage.size);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, slug }),
    };

  } catch (error) {
    console.error('Error storing link:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to store link' }),
    };
  }
};
