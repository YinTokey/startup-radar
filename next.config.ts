import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  },
  experimental: {
    // Enable better server-side rendering features for ISR
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
};

export default nextConfig;
