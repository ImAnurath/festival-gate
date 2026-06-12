import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The iyzipay SDK loads its resource files with a dynamic require() that the
  // production bundler (Turbopack) cannot statically resolve. Keep it out of the
  // server bundle and let it run via native Node require at runtime.
  serverExternalPackages: ["iyzipay"],
};

export default nextConfig;
