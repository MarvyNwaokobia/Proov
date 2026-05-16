/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // MetaMask SDK pulls in optional React Native storage — not needed in browser
      "@react-native-async-storage/async-storage": false,
    };

    // Stub out node-only modules that sneak in via wagmi connector barrel exports
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Suppress "Critical dependency: expression in require" from ox/tempo (Coinbase SDK)
    config.module = config.module ?? {};
    config.module.exprContextCritical = false;

    return config;
  },
};

module.exports = nextConfig;
