import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetlifyClient } from '../netlify';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NetlifyClient', () => {
  let client: NetlifyClient;
  const mockAuthToken = 'test-token';
  const mockSiteId = 'test-site-id';

  beforeEach(() => {
    client = new NetlifyClient(mockAuthToken, mockSiteId);
    vi.clearAllMocks();
  });

  describe('sha1', () => {
    it('should generate correct SHA1 hash', () => {
      const content = 'hello world';
      const hash = client.sha1(content);
      expect(hash).toBe('2aae6c35c94fcfb415dbe95f408b9ce91ee846ed'); // Known SHA1 of "hello world"
    });

    it('should generate different hashes for different content', () => {
      const hash1 = client.sha1('content1');
      const hash2 = client.sha1('content2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('byteLength', () => {
    it('should calculate correct byte length for ASCII content', () => {
      expect(client.byteLength('hello')).toBe(5);
    });

    it('should calculate correct byte length for UTF-8 content', () => {
      expect(client.byteLength('café')).toBe(5); // é is 2 bytes in UTF-8
    });
  });

  describe('createDeployDigest', () => {
    it('should create deploy with correct digest', async () => {
      const files = {
        'index.html': '<html><head><title>Test</title></head><body>Hello</body></html>',
        'styles.css': 'body { color: red; }'
      };

      const mockResponse = {
        id: 'deploy-123',
        required: ['sha1-hash-1', 'sha1-hash-2']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.createDeployDigest(files);

      expect(fetch).toHaveBeenCalledWith(
        `https://api.netlify.com/api/v1/sites/${mockSiteId}/deploys`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockAuthToken}`,
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('/index.html')
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle authentication errors', async () => {
      const files = { 'index.html': '<html></html>' };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      await expect(client.createDeployDigest(files)).rejects.toThrow('NETLIFY_AUTH');
    });

    it('should handle rate limit errors', async () => {
      const files = { 'index.html': '<html></html>' };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited')
      });

      await expect(client.createDeployDigest(files)).rejects.toThrow('NETLIFY_RATE_LIMIT');
    });
  });

  describe('uploadRequiredFiles', () => {
    it('should upload files for required SHAs', async () => {
      const files = {
        'index.html': '<html></html>',
        'styles.css': 'body { margin: 0; }'
      };

      const deployId = 'deploy-123';
      const indexSha = client.sha1(files['index.html']);
      const cssSha = client.sha1(files['styles.css']);
      const requiredShaList = [indexSha, cssSha];

      // Mock successful uploads
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('OK')
      });

      await client.uploadRequiredFiles(deployId, requiredShaList, files);

      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Check that each file was uploaded
      expect(fetch).toHaveBeenCalledWith(
        `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${mockAuthToken}`,
            'Content-Type': 'application/octet-stream',
          }
        })
      );
    });

    it('should handle upload failures', async () => {
      const files = { 'index.html': '<html></html>' };
      const deployId = 'deploy-123';
      const sha = client.sha1(files['index.html']);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Upload failed')
      });

      await expect(
        client.uploadRequiredFiles(deployId, [sha], files)
      ).rejects.toThrow('NETLIFY_REQUIRED_UPLOAD_FAILED');
    });

    it('should handle missing SHA in files', async () => {
      const files = { 'index.html': '<html></html>' };
      const deployId = 'deploy-123';
      const nonExistentSha = 'non-existent-sha';

      await expect(
        client.uploadRequiredFiles(deployId, [nonExistentSha], files)
      ).rejects.toThrow('NETLIFY_REQUIRED_UPLOAD_FAILED');
    });
  });

  describe('pollUntilReady', () => {
    it('should return deploy when ready', async () => {
      const deployId = 'deploy-123';
      const readyDeploy = {
        id: deployId,
        state: 'ready',
        ssl_url: 'https://example.netlify.app',
        required: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(readyDeploy)
      });

      const result = await client.pollUntilReady(deployId);
      expect(result).toEqual(readyDeploy);
    });

    it('should poll multiple times until ready', async () => {
      const deployId = 'deploy-123';
      
      // First call: building
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: deployId, state: 'building', required: [] })
      });
      
      // Second call: ready
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          id: deployId, 
          state: 'ready', 
          ssl_url: 'https://example.netlify.app',
          required: []
        })
      });

      const result = await client.pollUntilReady(deployId, 10000);
      expect(result.state).toBe('ready');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error on failed deploy', async () => {
      const deployId = 'deploy-123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: deployId, state: 'error', required: [] })
      });

      await expect(client.pollUntilReady(deployId)).rejects.toThrow('NETLIFY_DEPLOY_FAILED');
    });

    it('should timeout after max time', async () => {
      const deployId = 'deploy-123';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: deployId, state: 'building', required: [] })
      });

      await expect(
        client.pollUntilReady(deployId, 100) // Very short timeout
      ).rejects.toThrow('NETLIFY_DEPLOY_TIMEOUT');
    }, 10000);
  });

  describe('getDeployUrl', () => {
    it('should prefer ssl_url', () => {
      const deploy = {
        id: 'deploy-123',
        ssl_url: 'https://example.netlify.app',
        url: 'http://example.netlify.app',
        deploy_url: 'https://deploy-123--example.netlify.app',
        required: []
      };

      expect(client.getDeployUrl(deploy)).toBe('https://example.netlify.app');
    });

    it('should fallback to url if no ssl_url', () => {
      const deploy = {
        id: 'deploy-123',
        url: 'http://example.netlify.app',
        deploy_url: 'https://deploy-123--example.netlify.app',
        required: []
      };

      expect(client.getDeployUrl(deploy)).toBe('http://example.netlify.app');
    });

    it('should fallback to deploy_url if no ssl_url or url', () => {
      const deploy = {
        id: 'deploy-123',
        deploy_url: 'https://deploy-123--example.netlify.app',
        required: []
      };

      expect(client.getDeployUrl(deploy)).toBe('https://deploy-123--example.netlify.app');
    });

    it('should return empty string if no URLs available', () => {
      const deploy = {
        id: 'deploy-123',
        required: []
      };

      expect(client.getDeployUrl(deploy)).toBe('');
    });
  });
});
