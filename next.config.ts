import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/": ["./data/predictions/**/*.json"],
  },
};

export default nextConfig;
