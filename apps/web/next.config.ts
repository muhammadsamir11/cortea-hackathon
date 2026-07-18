import "@almedia/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  transpilePackages: ["shiki", "@almedia/forensic", "@almedia/ui", "@almedia/env"],
};

export default nextConfig;
