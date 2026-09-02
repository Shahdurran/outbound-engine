/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module: keep it external to the server bundle
  // so Next does not try to trace or bundle the prebuilt .node binary.
  serverExternalPackages: ["better-sqlite3"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
