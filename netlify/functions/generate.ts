import { Handler } from '@netlify/functions';
import { GenerateRequestSchema, ErrorResponse } from '../../src/lib/validation';
import { OpenAIClient } from '../../src/lib/openai';
import { NetlifyClient } from '../../src/lib/netlify';
import { createShortLink } from '../../src/lib/db';
import { checkRateLimit } from '../../src/lib/rate-limit';

export const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check rate limit
    const clientIP = event.headers['x-forwarded-for']?.split(',')[0] || 
                     event.headers['x-real-ip'] || 
                     'unknown';
    
    const rateLimitResult = await checkRateLimit(clientIP);
    
    if (!rateLimitResult.success) {
      return {
        statusCode: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        },
        body: JSON.stringify({ 
          error: 'RATE_LIMIT', 
          message: 'Too many requests. Please try again later.' 
        } as ErrorResponse),
      };
    }

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'VALIDATION_ERROR', 
          message: 'Request body is required' 
        } as ErrorResponse),
      };
    }

    const body = JSON.parse(event.body);
    const validationResult = GenerateRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'VALIDATION_ERROR', 
          message: validationResult.error.issues[0]?.message || 'Invalid request data' 
        } as ErrorResponse),
      };
    }

    const { prompt } = validationResult.data;

    // Check required environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const netlifyAuthToken = process.env.NETLIFY_AUTH_TOKEN;
    const netlifySiteId = process.env.NETLIFY_SITE_ID;

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'CONFIGURATION_ERROR', 
          message: 'Service configuration error' 
        } as ErrorResponse),
      };
    }

    if (!netlifyAuthToken || !netlifySiteId) {
      console.error('Netlify configuration missing');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'CONFIGURATION_ERROR', 
          message: 'Service configuration error' 
        } as ErrorResponse),
      };
    }

    // Generate site using OpenAI
    const openaiClient = new OpenAIClient(
      openaiApiKey, 
      process.env.OPENAI_MODEL || 'gpt-4.1-mini'
    );
    
    let siteFiles;
    try {
      siteFiles = await openaiClient.generateSite(prompt);
    } catch (error) {
      if (error instanceof Error && error.message === 'MODEL_INVALID_OUTPUT') {
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            error: 'MODEL_INVALID_OUTPUT', 
            message: 'The generator returned an invalid site. Try a shorter or simpler prompt.' 
          } as ErrorResponse),
        };
      }
      
      console.error('OpenAI API error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'OPENAI_ERROR', 
          message: 'Failed to generate site' 
        } as ErrorResponse),
      };
    }

    // Deploy to Netlify
    const netlifyClient = new NetlifyClient(netlifyAuthToken, netlifySiteId);
    
    let deployUrl;
    try {
      deployUrl = await netlifyClient.deployFiles(siteFiles.files);
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        if (errorMessage === 'NETLIFY_AUTH') {
          console.error('Netlify authentication failed');
          return {
            statusCode: 500,
            body: JSON.stringify({ 
              error: 'NETLIFY_AUTH', 
              message: 'Netlify auth misconfigured. Check NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID.' 
            } as ErrorResponse),
          };
        }
        
        if (errorMessage === 'NETLIFY_REQUIRED_UPLOAD_FAILED') {
          return {
            statusCode: 500,
            body: JSON.stringify({ 
              error: 'NETLIFY_REQUIRED_UPLOAD_FAILED', 
              message: "Couldn't upload required files. Please retry." 
            } as ErrorResponse),
          };
        }
        
        if (errorMessage === 'NETLIFY_DEPLOY_TIMEOUT') {
          return {
            statusCode: 500,
            body: JSON.stringify({ 
              error: 'NETLIFY_DEPLOY_TIMEOUT', 
              message: 'Deployment took too long. Please retry.' 
            } as ErrorResponse),
          };
        }
        
        if (errorMessage === 'NETLIFY_RATE_LIMIT') {
          return {
            statusCode: 429,
            body: JSON.stringify({ 
              error: 'NETLIFY_RATE_LIMIT', 
              message: 'Netlify rate limit exceeded. Please try again later.' 
            } as ErrorResponse),
          };
        }
      }
      
      console.error('Netlify deployment error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'NETLIFY_ERROR', 
          message: 'Failed to deploy site' 
        } as ErrorResponse),
      };
    }

    // Create short link
    try {
      const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'https://your-site.netlify.app';
      process.env.BASE_URL = baseUrl;
      
      const { shortUrl } = await createShortLink({ longUrl: deployUrl });
      
      return {
        statusCode: 200,
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shortUrl, deployUrl }),
      };
    } catch (error) {
      console.error('Database error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'DATABASE_ERROR', 
          message: 'Failed to create short link' 
        } as ErrorResponse),
      };
    }

  } catch (error) {
    console.error('Unexpected error in generate function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: 'An unexpected error occurred' 
      } as ErrorResponse),
    };
  }
};
