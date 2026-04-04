const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/persoonlijke-omgeving",
        destination: "/personal-workspace",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;