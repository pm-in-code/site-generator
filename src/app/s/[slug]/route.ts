import { NextRequest, NextResponse } from 'next/server';
import { getLongUrl } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    // Validate slug format (alphanumeric, 6-8 chars)
    if (!/^[a-z0-9]{6,8}$/.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid slug format' },
        { status: 400 }
      );
    }
    
    // Look up the long URL
    const longUrl = await getLongUrl(slug);
    
    if (!longUrl) {
      return NextResponse.json(
        { error: 'Short link not found' },
        { status: 404 }
      );
    }
    
    // Redirect to the long URL
    return NextResponse.redirect(longUrl, 302);
    
  } catch (error) {
    console.error('Error in redirect route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
