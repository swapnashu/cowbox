/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "dockerode",
      "@libsql/client",
      "@grpc/grpc-js",
      "@balena/dockerignore",
      "node-cron",
      "tar-fs",
      "bcryptjs",
      "ssh2",
      "adm-zip",
    ],
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        stream: false,
        crypto: false,
        path: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
      };
    }
    return config;
  },
};

export default nextConfig;
