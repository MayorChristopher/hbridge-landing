import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The RN app's package-lock.json one level up otherwise gets picked as the
  // workspace root, which breaks asset/file tracing for this project.
  turbopack: {
    root: path.join(__dirname),
  },
  // Allows viewing the dev server from another device on the same network
  // (e.g. a phone), same pattern as testing the RN app over a hotspot.
  allowedDevOrigins: ["10.243.16.55"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
