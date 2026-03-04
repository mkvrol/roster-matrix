/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.nhle.com",
        pathname: "/logos/nhl/svg/**",
      },
      {
        protocol: "https",
        hostname: "assets.nhle.com",
        pathname: "/mugs/**",
      },
      {
        protocol: "https",
        hostname: "cms.nhl.bamgrid.com",
        pathname: "/images/headshots/**",
      },
    ],
  },
};

export default nextConfig;
