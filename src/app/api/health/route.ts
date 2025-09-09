import { NextResponse } from 'next/server';
import { testDbConnection } from '@/lib/db';

export async function GET() {
  try {
    // Test database connection
    const dbHealthy = await testDbConnection();
    
    // Check required environment variables
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    const netlifyConfigured = !!(process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID);
    
    const healthy = dbHealthy && openaiConfigured && netlifyConfigured;
    
    return NextResponse.json({
      ok: healthy,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy,
        openai: openaiConfigured,
        netlify: netlifyConfigured,
      }
    }, {
      status: healthy ? 200 : 503
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, {
      status: 503
    });
  }
}
