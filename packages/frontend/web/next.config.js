/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // Add this line
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      { 
        module: /@assistant-ui\/react\/src\/context\/react\/utils\/ensureBinding\.ts/,
        message: /Unused '@ts-expect-error' directive/
      }
    ];
    return config;
  },
};

module.exports = nextConfig;