import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_WIDGET_BASE_PATH || "",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@workspace/ui"],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/widget.js",
          destination: "/api/embed-script",
        },
      ],
    };
  },
}

export default nextConfig
