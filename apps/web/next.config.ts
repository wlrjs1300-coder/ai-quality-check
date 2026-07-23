import type { NextConfig } from "next";

const backendApiBase = process.env.BACKEND_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendApiBase}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
