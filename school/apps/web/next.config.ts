import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // turbopack root option is dev-only and not needed for production builds
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
