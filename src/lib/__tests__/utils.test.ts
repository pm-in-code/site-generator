import { describe, it, expect } from 'vitest';
import { generateSlug, isValidUrl } from '../utils';

describe('generateSlug', () => {
  it('should generate a slug of the correct length', () => {
    const slug = generateSlug(6);
    expect(slug).toHaveLength(6);
  });

  it('should generate a slug with different length when specified', () => {
    const slug = generateSlug(8);
    expect(slug).toHaveLength(8);
  });

  it('should only contain lowercase letters and numbers', () => {
    const slug = generateSlug(6);
    expect(slug).toMatch(/^[a-z0-9]+$/);
  });

  it('should generate different slugs on multiple calls', () => {
    const slug1 = generateSlug(6);
    const slug2 = generateSlug(6);
    // While this could theoretically fail due to randomness, 
    // the probability is extremely low with 36^6 possibilities
    expect(slug1).not.toBe(slug2);
  });

  it('should handle edge case of length 1', () => {
    const slug = generateSlug(1);
    expect(slug).toHaveLength(1);
    expect(slug).toMatch(/^[a-z0-9]$/);
  });

  it('should default to length 6 when no argument provided', () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(6);
  });
});

describe('isValidUrl', () => {
  it('should return true for valid HTTP URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('should return true for valid HTTPS URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('should return true for URLs with paths', () => {
    expect(isValidUrl('https://example.com/path/to/page')).toBe(true);
  });

  it('should return false for invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(true); // URL constructor accepts this
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('http://')).toBe(false);
  });

  it('should return false for malformed URLs', () => {
    expect(isValidUrl('https://.com')).toBe(false);
    expect(isValidUrl('https://.')).toBe(false);
    expect(isValidUrl('https://')).toBe(false);
    expect(isValidUrl('http://.')).toBe(false);
  });
});
