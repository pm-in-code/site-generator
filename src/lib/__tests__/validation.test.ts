import { describe, it, expect } from 'vitest';
import { GenerateRequestSchema } from '../validation';

describe('GenerateRequestSchema', () => {
  it('should accept valid prompts', () => {
    const validPrompt = 'Landing page for a coworking space';
    const result = GenerateRequestSchema.safeParse({ prompt: validPrompt });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe(validPrompt);
    }
  });

  it('should trim whitespace from prompts', () => {
    const result = GenerateRequestSchema.safeParse({ prompt: '  test prompt  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe('test prompt');
    }
  });

  it('should reject empty prompts', () => {
    const result = GenerateRequestSchema.safeParse({ prompt: '' });
    expect(result.success).toBe(false);
  });

  it('should reject prompts with only whitespace', () => {
    const result = GenerateRequestSchema.safeParse({ prompt: '   ' });
    expect(result.success).toBe(false);
  });

  it('should reject prompts longer than 500 characters', () => {
    const longPrompt = 'a'.repeat(501);
    const result = GenerateRequestSchema.safeParse({ prompt: longPrompt });
    expect(result.success).toBe(false);
  });

  it('should accept prompts exactly 500 characters long', () => {
    const maxPrompt = 'a'.repeat(500);
    const result = GenerateRequestSchema.safeParse({ prompt: maxPrompt });
    expect(result.success).toBe(true);
  });

  it('should reject missing prompt field', () => {
    const result = GenerateRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject non-string prompt values', () => {
    const result = GenerateRequestSchema.safeParse({ prompt: 123 });
    expect(result.success).toBe(false);
  });
});
