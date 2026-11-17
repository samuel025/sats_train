import path from "node:path";
export default {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["better-sqlite3", "nostr-tools", "@getalby/sdk", "ws"],
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    return config;
  },
};
