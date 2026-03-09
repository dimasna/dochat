/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  serverExternalPackages: ["@prisma/client", "prisma"],
  devIndicators: false,
};

export default nextConfig;
