import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.output = config.output ?? {};
      config.output.chunkFilename = "[name].js";
    }

    return config;
  }
};

export default nextConfig;
