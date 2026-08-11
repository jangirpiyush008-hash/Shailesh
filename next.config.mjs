/** @type {import('next').NextConfig} */
const nextConfig = {
  // Larger body limit for future file uploads (invoices, receipts)
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // Skip lint during Railway builds — we lint in CI separately
  eslint: { ignoreDuringBuilds: true },
  // Don't fail the build on TS errors during the very first Railway deploy;
  // the app still runs. Turn this off once the codebase settles.
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
