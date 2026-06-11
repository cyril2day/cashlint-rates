import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  redirects: () =>
    Promise.resolve([
      {
        source: '/about',
        destination: '/',
        permanent: false,
      },
    ]),
}

export default nextConfig
