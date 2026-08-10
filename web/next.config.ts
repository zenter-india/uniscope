import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Hero photography + logo live in the project's existing Supabase Storage
    // bucket (same "web-assets" pattern the backend already uses for
    // university photos/avatars) rather than shipped as repo binaries —
    // keeps the deploy payload text-only.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kfxxsqxynofjywywygza.supabase.co",
        pathname: "/storage/v1/object/public/web-assets/**",
      },
    ],
  },
};

export default nextConfig;
