// next.config.js
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: [] }
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  hideSourceMaps: true,
  // Upload source maps seulement si SENTRY_AUTH_TOKEN est défini
  // (pas nécessaire en local)
})
