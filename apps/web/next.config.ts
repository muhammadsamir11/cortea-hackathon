import "@almedia/env/web";
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  typedRoutes: true,
  reactCompiler: true,
  transpilePackages: ["shiki", "@almedia/forensic", "@almedia/ui", "@almedia/env"],
};

export default withEve(nextConfig);
