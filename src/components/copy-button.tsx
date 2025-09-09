'use client';

import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      className={`px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 
        rounded-md transition-colors duration-200 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
        ${className}`}
      title="Copy to clipboard"
    >
      {copied ? '✓ Copied!' : 'Copy'}
    </button>
  );
}
