/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  i18n: {
    locales: ['en', 'ko', 'uz'],
    defaultLocale: 'en',
    // OFF: with detection on, visiting "/" would auto-redirect customers to /ko or /uz
    // based on their browser language, turning the public store URL into /ko etc.
    // The portfolio's language switcher still works manually (it passes { locale }).
    localeDetection: false,
  },
  async headers() {
    // Keep the PUBLIC store (/ and /product/*) indexable so customers can find it.
    // Keep the portfolio, the admin/seller app, and login PRIVATE (noindex) — across
    // both the default URL and any locale-prefixed variant (/uz/..., /ko/...).
    const noindex = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
    ]
    const privatePaths = [
      '/careers/:path*',
      '/admin/:path*',
      '/seller/:path*',
      '/login',
    ]
    return privatePaths.flatMap((p) => [
      { source: p, headers: noindex },
      { source: `/:locale(en|ko|uz)${p}`, headers: noindex },
    ])
  },
}

module.exports = nextConfig
