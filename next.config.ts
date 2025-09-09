import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Disable API routes for static export
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
