import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1/api/:path*",
      },
      {
        source: "/avatars/:path*",
        destination: "http://127.0.0.1/avatars/:path*",
      },
    ];
  },
};

export default nextConfig;
