import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_ASSISTANT_CLOUD_API_KEY: process.env.NEXT_PUBLIC_ASSISTANT_CLOUD_API_KEY,
    NEXT_PUBLIC_ASSISTANT_CLOUD_USER_ID: process.env.NEXT_PUBLIC_ASSISTANT_CLOUD_USER_ID,
    NEXT_PUBLIC_ASSISTANT_CLOUD_WORKSPACE_ID: process.env.NEXT_PUBLIC_ASSISTANT_CLOUD_WORKSPACE_ID,
  },
};

export default nextConfig;