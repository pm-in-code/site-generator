import CryptoJS from 'crypto-js';

export interface DeployResponse {
  id: string;
  required: string[];
  ssl_url?: string;
  url?: string;
  deploy_url?: string;
  state?: string;
}

export interface DeployDigest {
  [path: string]: string;
}

export class NetlifyClient {
  private authToken: string;
  private siteId: string;
  private baseUrl = 'https://api.netlify.com/api/v1';

  constructor(authToken: string, siteId: string) {
    this.authToken = authToken;
    this.siteId = siteId;
  }

  /**
   * Calculate SHA1 hash of content
   */
  sha1(content: string): string {
    return CryptoJS.SHA1(content).toString(CryptoJS.enc.Hex);
  }

  /**
   * Get byte length of content
   */
  byteLength(content: string): number {
    return Buffer.byteLength(content, 'utf8');
  }

  /**
   * Create deployment digest
   */
  async createDeployDigest(files: Record<string, string>): Promise<DeployResponse> {
    const digest: DeployDigest = {};
    
    // Build digest mapping paths to SHA1 hashes
    for (const [filename, content] of Object.entries(files)) {
      const path = filename.startsWith('/') ? filename : `/${filename}`;
      digest[path] = this.sha1(content);
    }

    const response = await fetch(`${this.baseUrl}/sites/${this.siteId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: digest,
        draft: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error('NETLIFY_AUTH');
      }
      if (response.status === 429) {
        throw new Error('NETLIFY_RATE_LIMIT');
      }
      throw new Error(`Netlify API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Upload required files to Netlify
   */
  async uploadRequiredFiles(
    deployId: string,
    requiredShaList: string[],
    files: Record<string, string>
  ): Promise<void> {
    // Create reverse mapping from SHA to file paths
    const shaToFiles: Record<string, string[]> = {};
    
    for (const [filename, content] of Object.entries(files)) {
      const path = filename.startsWith('/') ? filename : `/${filename}`;
      const sha = this.sha1(content);
      if (!shaToFiles[sha]) {
        shaToFiles[sha] = [];
      }
      shaToFiles[sha].push(path);
    }

    // Upload each required SHA
    for (const requiredSha of requiredShaList) {
      const filePaths = shaToFiles[requiredSha];
      if (!filePaths || filePaths.length === 0) {
        throw new Error('NETLIFY_REQUIRED_UPLOAD_FAILED');
      }

      // Find the file content for this SHA
      let fileContent: string | undefined;
      for (const [, content] of Object.entries(files)) {
        if (this.sha1(content) === requiredSha) {
          fileContent = content;
          break;
        }
      }

      if (!fileContent) {
        throw new Error('NETLIFY_REQUIRED_UPLOAD_FAILED');
      }

      // Upload to the first path (they all have the same content)
      const uploadPath = filePaths[0];

      const uploadResponse = await fetch(
        `${this.baseUrl}/deploys/${deployId}/files${uploadPath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: Buffer.from(fileContent, 'utf8'),
        }
      );

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error(`Failed to upload ${uploadPath}:`, error);
        throw new Error('NETLIFY_REQUIRED_UPLOAD_FAILED');
      }
    }
  }

  /**
   * Poll deployment until ready with exponential backoff
   */
  async pollUntilReady(deployId: string, maxTimeoutMs = 90000): Promise<DeployResponse> {
    const startTime = Date.now();
    let delay = 1000; // Start with 1 second
    const maxDelay = 8000; // Max 8 seconds between polls

    while (Date.now() - startTime < maxTimeoutMs) {
      const response = await fetch(`${this.baseUrl}/deploys/${deployId}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to poll deployment: ${response.status} ${error}`);
      }

      const deploy: DeployResponse = await response.json();

      if (deploy.state === 'ready') {
        return deploy;
      }

      if (deploy.state === 'error' || deploy.state === 'failed') {
        throw new Error('NETLIFY_DEPLOY_FAILED');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff
      delay = Math.min(delay * 1.5, maxDelay);
    }

    throw new Error('NETLIFY_DEPLOY_TIMEOUT');
  }

  /**
   * Get deployment URL from deploy object
   */
  getDeployUrl(deploy: DeployResponse): string {
    return deploy.ssl_url || deploy.url || deploy.deploy_url || '';
  }

  /**
   * Full deployment flow
   */
  async deployFiles(files: Record<string, string>): Promise<string> {
    try {
      // Step 1: Create deployment digest
      const deployResponse = await this.createDeployDigest(files);

      // Step 2: Upload required files
      if (deployResponse.required && deployResponse.required.length > 0) {
        await this.uploadRequiredFiles(deployResponse.id, deployResponse.required, files);
      }

      // Step 3: Poll until ready
      const readyDeploy = await this.pollUntilReady(deployResponse.id);

      // Step 4: Return URL
      const deployUrl = this.getDeployUrl(readyDeploy);
      if (!deployUrl) {
        throw new Error('NETLIFY_NO_URL');
      }

      return deployUrl;
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw known errors
        if ([
          'NETLIFY_AUTH',
          'NETLIFY_RATE_LIMIT',
          'NETLIFY_REQUIRED_UPLOAD_FAILED',
          'NETLIFY_DEPLOY_TIMEOUT',
          'NETLIFY_DEPLOY_FAILED',
          'NETLIFY_NO_URL'
        ].includes(error.message)) {
          throw error;
        }
      }
      
      // Wrap unknown errors
      throw new Error(`NETLIFY_DEPLOY_ERROR: ${error}`);
    }
  }
}
