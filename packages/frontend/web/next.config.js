/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Webpack config to ignore specific type errors
  webpack: (config) => {
    // Ignore the specific type error from @assistant-ui/react
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
