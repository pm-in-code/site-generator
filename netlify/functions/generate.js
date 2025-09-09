// Function to deploy HTML to Netlify
async function deployToNetlify(htmlContent) {
  const netlifyToken = process.env.NETLIFY_AUTH_TOKEN;
  
  if (!netlifyToken) {
    // Fallback to data URL if Netlify not configured
    return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
  }

  try {
    // Create a new site on Netlify
    const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `brayn-site-${Math.random().toString(36).substring(2, 8)}`,
      }),
    });

    if (!createSiteResponse.ok) {
      throw new Error('Failed to create Netlify site');
    }

    const site = await createSiteResponse.json();
    const siteId = site.id;

    // Create a deploy with the HTML file
    const files = {
      '/index.html': htmlContent,
    };

    // Calculate file digest (simple hash for Netlify)
    const digest = {};
    for (const [path, content] of Object.entries(files)) {
      // Simple hash - in production you'd use SHA1
      digest[path] = Math.random().toString(36);
    }

    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: digest,
        draft: false,
      }),
    });

    if (!deployResponse.ok) {
      throw new Error('Failed to create deploy');
    }

    const deploy = await deployResponse.json();
    const deployId = deploy.id;

    // Upload the HTML file
    const uploadResponse = await fetch(
      `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${netlifyToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: htmlContent,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    // Wait for deploy to be ready (simplified polling)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Return the site URL
    return site.ssl_url || site.url || `https://${site.name}.netlify.app`;

  } catch (error) {
    console.error('Netlify deploy error:', error);
    // Fallback to data URL
    return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
  }
}

// Netlify Function for AI site generation
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse request body
    const { prompt } = JSON.parse(event.body || '{}');
    
    // Validate prompt
    if (!prompt || prompt.length < 1 || prompt.length > 500) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'VALIDATION_ERROR',
          message: 'Prompt must be between 1 and 500 characters' 
        }),
      };
    }

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPEN_AI;
    if (!openaiApiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'CONFIGURATION_ERROR',
          message: 'OpenAI API not configured' 
        }),
      };
    }

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a web developer. Create a complete, beautiful HTML page based on the user's description. 
            Rules:
            - Generate only ONE complete HTML file with inline CSS and JavaScript
            - Make it modern, responsive, and visually appealing
            - Use only inline styles (no external CSS frameworks)
            - Include meta viewport tag for mobile
            - Add some interactivity with JavaScript if appropriate
            - Keep total size under 200KB
            - No external resources (CDNs, images from URLs)
            - Use semantic HTML5
            Return ONLY the HTML code, no explanations.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', await openaiResponse.text());
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'OPENAI_ERROR',
          message: 'Failed to generate site' 
        }),
      };
    }

    const openaiData = await openaiResponse.json();
    const generatedHtml = openaiData.choices[0]?.message?.content;

    if (!generatedHtml) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'MODEL_INVALID_OUTPUT',
          message: 'The generator returned an invalid site. Try a shorter or simpler prompt.' 
        }),
      };
    }

    // Deploy the HTML (using data URL for now)
    const deployUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedHtml)}`;
    
    // Create short link
    const baseUrl = process.env.URL || 'https://prompt2site-demo.netlify.app';
    const shortSlug = Math.random().toString(36).substring(2, 8);
    const shortUrl = `${baseUrl}/s/${shortSlug}`;
    
    // Store the short link mapping
    // Call the redirect function to store the mapping
    try {
      await fetch(`${baseUrl}/.netlify/functions/store-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: shortSlug, url: deployUrl })
      });
    } catch (error) {
      console.log('Could not store link mapping:', error);
      // Continue anyway, direct URL will still work
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        shortUrl,
        deployUrl,
        html: generatedHtml,
        deployMethod: 'data-url'
      }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred' 
      }),
    };
  }
};
