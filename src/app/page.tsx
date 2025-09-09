'use client';

import { useState } from 'react';
import { StatusIndicator } from '@/components/status-indicator';
import { CopyButton } from '@/components/copy-button';
import { GenerateRequest, GenerateResponse, ErrorResponse } from '@/lib/validation';

interface GenerationState {
  status: 'idle' | 'generating' | 'success' | 'error';
  result?: GenerateResponse;
  error?: string;
  progress?: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [generation, setGeneration] = useState<GenerationState>({ status: 'idle' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;
    
    setGeneration({ status: 'generating', progress: 'Generating your site...' });

    // Demo mode - show success after delay
    setTimeout(() => {
      setGeneration({ 
        status: 'success', 
        result: {
          shortUrl: 'https://prompt2site-demo.netlify.app/s/demo123',
          deployUrl: 'https://demo-site.netlify.app'
        }
      });
    }, 2000);
  };

  const handleReset = () => {
    setGeneration({ status: 'idle' });
    setPrompt('');
  };

  const isGenerating = generation.status === 'generating';
  const canSubmit = prompt.trim().length > 0 && prompt.length <= 500 && !isGenerating;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Prompt2Site
          </h1>
          <p className="text-gray-600 text-lg">
            Turn your ideas into live websites instantly
          </p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                Describe your website
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Landing page for a coworking space with pricing tiers and contact form"
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  resize-none text-gray-900 placeholder-gray-500"
                maxLength={500}
                disabled={isGenerating}
              />
              <div className="flex justify-between items-center mt-2">
                <span className={`text-sm ${prompt.length > 450 ? 'text-red-500' : 'text-gray-500'}`}>
                  {prompt.length}/500 characters
                </span>
                {prompt.length > 500 && (
                  <span className="text-sm text-red-500">Too long!</span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg 
                transition-colors duration-200 focus:outline-none focus:ring-2 
                focus:ring-blue-500 focus:ring-offset-2"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle 
                      cx="12" cy="12" r="10" 
                      stroke="currentColor" strokeWidth="4" 
                      fill="none" strokeLinecap="round" 
                      strokeDasharray="32" strokeDashoffset="32"
                    >
                      <animate 
                        attributeName="stroke-dasharray" 
                        dur="2s" 
                        values="0 64;32 32;0 64" 
                        repeatCount="indefinite"
                      />
                      <animate 
                        attributeName="stroke-dashoffset" 
                        dur="2s" 
                        values="0;-32;-64" 
                        repeatCount="indefinite"
                      />
                    </circle>
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Site'
              )}
            </button>
          </form>
        </div>

        {/* Status/Results Area */}
        {generation.status !== 'idle' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {generation.status === 'generating' && (
              <div className="text-center">
                <div className="text-blue-600 font-medium mb-2">
                  {generation.progress}
                </div>
                <div className="text-sm text-gray-500">
                  This may take up to 30 seconds...
                </div>
              </div>
            )}

            {generation.status === 'success' && generation.result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Site Generated Successfully!
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Your short link:
                      </p>
                      <p className="text-lg font-mono text-blue-600 break-all">
                        {generation.result.shortUrl}
                      </p>
                    </div>
                    <CopyButton text={generation.result.shortUrl} />
                  </div>
                </div>

                {generation.result.deployUrl && (
                  <div className="text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Direct link:</span>{' '}
                      <a 
                        href={generation.result.deployUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {generation.result.deployUrl}
                      </a>
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <a
                    href={generation.result.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg 
                      transition-colors duration-200 text-sm font-medium"
                  >
                    View Site
                  </a>
                  <button
                    onClick={handleReset}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg 
                      transition-colors duration-200 text-sm font-medium"
                  >
                    Generate Another
                  </button>
                </div>
              </div>
            )}

            {generation.status === 'error' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600 font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Generation Failed
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-red-700">{generation.error}</p>
                </div>

                <button
                  onClick={handleReset}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg 
                    transition-colors duration-200 text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <StatusIndicator />
          <p className="text-sm text-gray-500 mt-4">
            Built with Next.js, OpenAI, and Netlify
          </p>
        </div>
      </div>
    </main>
  );
}