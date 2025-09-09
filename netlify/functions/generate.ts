import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { GenerateRequestSchema, ErrorResponse } from '../../src/lib/validation';
import { OpenAIClient } from '../../src/lib/openai';
import { NetlifyClient } from '../../src/lib/netlify';
import { createShortLink } from '../../src/lib/db';
import { checkRateLimit } from '../../src/lib/rate-limit';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
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
          'Content-Type': 'application/json',
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'CONFIGURATION_ERROR', 
          message: 'Service configuration error' 
        } as ErrorResponse),
      };
    }

    if (!netlifyAuthToken || !netlifySiteId) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'MODEL_INVALID_OUTPUT', 
            message: 'The generator returned an invalid site. Try a shorter or simpler prompt.' 
          } as ErrorResponse),
        };
      }
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
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
          return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              error: 'NETLIFY_AUTH', 
              message: 'Netlify auth misconfigured.' 
            } as ErrorResponse),
          };
        }
        
        if (errorMessage.includes('NETLIFY_')) {
          return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              error: errorMessage, 
              message: 'Deployment failed. Please retry.' 
            } as ErrorResponse),
          };
        }
      }
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'NETLIFY_ERROR', 
          message: 'Failed to deploy site' 
        } as ErrorResponse),
      };
    }

    // Create short link
    try {
      const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'https://prompt2site-demo.netlify.app';
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
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'DATABASE_ERROR', 
          message: 'Failed to create short link' 
        } as ErrorResponse),
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: 'An unexpected error occurred' 
      } as ErrorResponse),
    };
  }
};