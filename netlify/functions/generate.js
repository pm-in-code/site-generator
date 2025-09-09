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
    const openaiApiKey = process.env.OPENAI_API_KEY;
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

    // For now, return the HTML directly
    // In future versions, we can deploy this to another Netlify site
    const mockDeployUrl = `data:text/html;charset=utf-8,${encodeURIComponent(generatedHtml)}`;
    const baseUrl = process.env.URL || 'https://prompt2site-demo.netlify.app';
    const shortSlug = Math.random().toString(36).substring(2, 8);
    const shortUrl = `${baseUrl}/s/${shortSlug}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        shortUrl,
        deployUrl: mockDeployUrl,
        html: generatedHtml
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
