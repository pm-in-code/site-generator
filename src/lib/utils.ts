import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a random URL-safe slug
 */
export function generateSlug(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Additional checks for malformed URLs
    return parsedUrl.hostname !== '' && 
           parsedUrl.hostname !== '.' && 
           parsedUrl.hostname !== '.com' &&
           !parsedUrl.hostname.startsWith('.') &&
           !parsedUrl.hostname.endsWith('.');
  } catch {
    return false;
  }
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
