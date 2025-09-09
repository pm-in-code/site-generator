import { z } from 'zod';

const SiteFilesSchema = z.object({
  files: z.record(z.string(), z.string()),
});

export type SiteFiles = z.infer<typeof SiteFilesSchema>;

export class OpenAIClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4.1-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateSite(prompt: string): Promise<SiteFiles> {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        reasoning: { effort: 'medium' },
        input: [
          {
            role: 'system',
            content: 'You generate minimal static one-page websites. Output MUST be strict JSON with keys index.html (+ optional styles.css, script.js). No external assets/analytics/CDNs or remote URLs. Keep total size <= 200 KB. If styles.css/script.js present, reference them relatively from index.html.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'site_files',
            schema: {
              type: 'object',
              properties: {
                files: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
              },
              required: ['files'],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    // Parse and validate the response
    const result = SiteFilesSchema.safeParse(data);
    if (!result.success) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    const { files } = result.data;

    // Validate required files and content
    this.validateSiteFiles(files);

    return { files };
  }

  private validateSiteFiles(files: Record<string, string>): void {
    // Check if index.html exists
    if (!files['index.html']) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    const indexHtml = files['index.html'];

    // Check for required HTML structure
    if (!indexHtml.includes('<!doctype html>') && !indexHtml.includes('<!DOCTYPE html>')) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    if (!indexHtml.includes('<title>') || !indexHtml.includes('</title>')) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    if (!indexHtml.includes('<meta name="viewport"')) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    // Check for external resources (no remote URLs allowed)
    const externalUrlPattern = /(href|src)=["']https?:\/\//i;
    if (externalUrlPattern.test(indexHtml)) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    // Check if styles.css or script.js are referenced properly
    if (files['styles.css'] && !indexHtml.includes('styles.css')) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    if (files['script.js'] && !indexHtml.includes('script.js')) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    // Check total size limit (200 KB)
    const totalSize = Object.values(files).reduce(
      (sum, content) => sum + Buffer.byteLength(content, 'utf8'),
      0
    );

    if (totalSize > 200 * 1024) {
      throw new Error('MODEL_INVALID_OUTPUT');
    }

    // Check for forbidden patterns
    const forbiddenPatterns = [
      /eval\s*\(/i,
      /new\s+Function\s*\(/i,
      /document\.write\s*\(/i,
    ];

    for (const content of Object.values(files)) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          throw new Error('MODEL_INVALID_OUTPUT');
        }
      }
    }
  }
}
