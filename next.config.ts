import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  /* config options here */
};

// Wrap with Sentry for error tracking and source maps
export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output during build
  silent: true,
  
  // Source map configuration
  sourcemaps: {
    // Don't expose source maps publicly (security)
    deleteSourcemapsAfterUpload: true,
  },
  
  // Disable Sentry telemetry
  telemetry: false,
});
