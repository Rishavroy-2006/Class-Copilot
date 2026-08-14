/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
      },
      {
        source: '/connect',
        destination: '/connect.html',
      },
      {
        source: '/dashboard',
        destination: '/dashboard.html',
      },
    ];
  },
};

export default nextConfig;
