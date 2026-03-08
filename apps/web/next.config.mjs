/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  serverExternalPackages: ["@prisma/client", "prisma"],
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/workspace",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
