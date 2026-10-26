import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow the sandbox preview gateway hosts during development
  allowedDevOrigins: [
    "preview-chat-a1e16769-7d7a-48ce-8898-d4c14e1d4a9b.space-z.ai",
    "*.space-z.ai",
    "*.fcapp.run",
  ],
  images: {
    // Only local posters/backdrops are used; keep optimizer happy if remote covers are added later
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
