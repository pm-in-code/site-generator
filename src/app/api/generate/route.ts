import { NextRequest, NextResponse } from 'next/server';
import { GenerateRequestSchema, ErrorResponse } from '@/lib/validation';
import { OpenAIClient } from '@/lib/openai';
import { NetlifyClient } from '@/lib/netlify';
import { createShortLink } from '@/lib/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkRateLimit(clientIP);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' } as ErrorResponse,
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          }
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = GenerateRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'VALIDATION_ERROR', 
          message: validationResult.error.issues[0]?.message || 'Invalid request data' 
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const { prompt } = validationResult.data;

    // Check required environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const netlifyAuthToken = process.env.NETLIFY_AUTH_TOKEN;
    const netlifySiteId = process.env.NETLIFY_SITE_ID;

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'CONFIGURATION_ERROR', message: 'Service configuration error' } as ErrorResponse,
        { status: 500 }
      );
    }

    if (!netlifyAuthToken || !netlifySiteId) {
      console.error('Netlify configuration missing');
      return NextResponse.json(
        { error: 'CONFIGURATION_ERROR', message: 'Service configuration error' } as ErrorResponse,
        { status: 500 }
      );
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
        return NextResponse.json(
          { 
            error: 'MODEL_INVALID_OUTPUT', 
            message: 'The generator returned an invalid site. Try a shorter or simpler prompt.' 
          } as ErrorResponse,
          { status: 400 }
        );
      }
      
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'OPENAI_ERROR', message: 'Failed to generate site' } as ErrorResponse,
        { status: 500 }
      );
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
          return NextResponse.json(
            { 
              error: 'NETLIFY_AUTH', 
              message: 'Netlify auth misconfigured. Check NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID.' 
            } as ErrorResponse,
            { status: 500 }
          );
        }
        
        if (errorMessage === 'NETLIFY_REQUIRED_UPLOAD_FAILED') {
          return NextResponse.json(
            { 
              error: 'NETLIFY_REQUIRED_UPLOAD_FAILED', 
              message: "Couldn't upload required files. Please retry." 
            } as ErrorResponse,
            { status: 500 }
          );
        }
        
        if (errorMessage === 'NETLIFY_DEPLOY_TIMEOUT') {
          return NextResponse.json(
            { 
              error: 'NETLIFY_DEPLOY_TIMEOUT', 
              message: 'Deployment took too long. Please retry.' 
            } as ErrorResponse,
            { status: 500 }
          );
        }
        
        if (errorMessage === 'NETLIFY_RATE_LIMIT') {
          return NextResponse.json(
            { 
              error: 'NETLIFY_RATE_LIMIT', 
              message: 'Netlify rate limit exceeded. Please try again later.' 
            } as ErrorResponse,
            { status: 429 }
          );
        }
      }
      
      console.error('Netlify deployment error:', error);
      return NextResponse.json(
        { error: 'NETLIFY_ERROR', message: 'Failed to deploy site' } as ErrorResponse,
        { status: 500 }
      );
    }

    // Create short link
    try {
      const { shortUrl } = await createShortLink({ longUrl: deployUrl });
      
      return NextResponse.json(
        { shortUrl, deployUrl },
        {
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          }
        }
      );
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Failed to create short link' } as ErrorResponse,
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Unexpected error in /api/generate:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } as ErrorResponse,
      { status: 500 }
    );
  }
}
