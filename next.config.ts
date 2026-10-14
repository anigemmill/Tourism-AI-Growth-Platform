import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev-only indicator clear of the sidebar's sign-out control.
  devIndicators: { position: "bottom-right" },
  poweredByHeader: false,
  // Prisma's generated client (custom output path: src/generated/prisma)
  // resolves its query-engine binary via dynamic fs.existsSync() probing,
  // which Turbopack's tracer can't statically scope — it conservatively
  // warns that it may sweep the whole project into every server function's
  // output. Excluding directories that are never needed at runtime keeps
  // that tracing bounded regardless of what Prisma's resolver touches.
  outputFileTracingExcludes: {
    "*": ["docs/**", "tests/**", ".github/**", "*.md"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
