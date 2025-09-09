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
            content: `You are an expert web designer and developer. Create a stunning, modern HTML page based on the user's description.

DESIGN REQUIREMENTS:
- Create a visually striking, professional-grade website
- Use modern CSS with gradients, shadows, animations, and transitions
- Implement CSS Grid and Flexbox for perfect layouts
- Add smooth hover effects and micro-interactions
- Use beautiful typography with Google Fonts (include @import)
- Create engaging animations with CSS keyframes
- Use vibrant color schemes and modern design trends
- Add subtle parallax effects where appropriate

CONTENT & IMAGES:
- Use placeholder images from https://picsum.photos/ (e.g., https://picsum.photos/800/600)
- Create relevant placeholder content that matches the theme
- Add icons using Unicode symbols or CSS-drawn icons
- Include engaging copy and compelling calls-to-action

INTERACTIVITY:
- Add JavaScript for smooth scrolling, form validation, and interactive elements
- Implement mobile-responsive hamburger menus
- Create modal windows, carousels, or tabs if relevant
- Add scroll-triggered animations

TECHNICAL:
- Generate only ONE complete HTML file with inline CSS and JavaScript
- Include proper meta tags and viewport settings
- Keep total size under 200KB
- No external resources except Google Fonts
- Use semantic HTML5 structure
- Add "Generated by BRAYN - Prompt2Site" in footer

Make it look like a premium, professionally designed website that could cost $5000+!

Return ONLY the HTML code, no explanations.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 8000,
        temperature: 0.8
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

    // Basic quality check
    const hasBasicStructure = generatedHtml.includes('<html') && 
                              generatedHtml.includes('<head>') && 
                              generatedHtml.includes('<body>') &&
                              generatedHtml.includes('<style>');
    
    if (!hasBasicStructure) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'MODEL_INVALID_OUTPUT',
          message: 'Generated site lacks proper HTML structure. Please try again.' 
        }),
      };
    }

    // Deploy the HTML (using data URL for now)
    const deployUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedHtml)}`;
    
    // Use deploy URL directly - no short links for now
    const shortUrl = deployUrl;

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
