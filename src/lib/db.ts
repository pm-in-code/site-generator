import { PrismaClient } from '@prisma/client';
import { generateSlug } from './utils';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export interface CreateLinkOptions {
  longUrl: string;
  maxRetries?: number;
}

/**
 * Create a new short link with a unique slug
 */
export async function createShortLink({ 
  longUrl, 
  maxRetries = 5 
}: CreateLinkOptions): Promise<{ slug: string; shortUrl: string }> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const slug = generateSlug(6 + attempt); // Increase length on retries
    
    try {
      await prisma.link.create({
        data: {
          slug,
          longUrl,
        },
      });
      
      return {
        slug,
        shortUrl: `${baseUrl}/s/${slug}`,
      };
    } catch (error) {
      // If it's a unique constraint violation, try again with a new slug
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw new Error('Failed to generate unique slug after multiple attempts');
}

/**
 * Get long URL by slug
 */
export async function getLongUrl(slug: string): Promise<string | null> {
  const link = await prisma.link.findUnique({
    where: { slug },
  });
  
  return link?.longUrl || null;
}

/**
 * Test database connection
 */
export async function testDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
