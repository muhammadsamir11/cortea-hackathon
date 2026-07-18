import "@almedia/env/web";
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  transpilePackages: ["shiki", "@almedia/forensic", "@almedia/ui", "@almedia/env"],
};

export default withEve(nextConfig);
