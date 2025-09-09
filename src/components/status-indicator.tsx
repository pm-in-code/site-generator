'use client';

import { useEffect, useState } from 'react';

interface HealthCheck {
  ok: boolean;
  checks?: {
    database: boolean;
    openai: boolean;
    netlify: boolean;
  };
}

export function StatusIndicator() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setHealth(data);
      } catch {
        setHealth({ ok: false });
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
        <span>Checking status...</span>
      </div>
    );
  }

  const isHealthy = health?.ok;
  const statusColor = isHealthy ? 'bg-green-500' : 'bg-red-500';
  const statusText = isHealthy ? 'All systems operational' : 'Some services unavailable';

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className={`w-2 h-2 ${statusColor} rounded-full`}></div>
      <span>{statusText}</span>
      {health?.checks && !isHealthy && (
        <div className="text-xs text-gray-500 ml-2">
          DB: {health.checks.database ? '✓' : '✗'}
          {' '}API: {health.checks.openai ? '✓' : '✗'}
          {' '}Deploy: {health.checks.netlify ? '✓' : '✗'}
        </div>
      )}
    </div>
  );
}
