
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // Firestore / Auth must bypass the SW — caching or stale handlers break WebChannel (login, snapshots).
    {
      urlPattern:
        /^https:\/\/(firestore|securetoken|identitytoolkit|firebaseinstallations)\.googleapis\.com\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https\:\/\/firebasestorage\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-storage-images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https\:\/\/storage\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-storage-general',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      // This is the crucial change for offline navigation
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'CacheFirst',
      options: {
        cacheName: 'pages-cache',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      handler: 'NetworkFirst',
      urlPattern: /.*/,
      options: {
        cacheName: 'all-other-requests',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 10 * 60, // 10 minutes
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
});

import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default withPWA(nextConfig);
