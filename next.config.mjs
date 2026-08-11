/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output — Next.js emits a self-contained server bundle at
  // .next/standalone that runs with `node server.js`. Keeps the Docker
  // image small (only the deps Next.js actually needs at runtime).
  output: "standalone",
  // Larger body limit for future file uploads (invoices, receipts)
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
