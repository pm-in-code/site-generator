import { z } from 'zod';

export const GenerateRequestSchema = z.object({
  prompt: z.string()
    .trim()
    .min(1, 'Prompt cannot be empty')
    .max(500, 'Prompt must be 500 characters or less'),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const GenerateResponseSchema = z.object({
  shortUrl: z.string().url(),
  deployUrl: z.string().url().optional(),
});

export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
