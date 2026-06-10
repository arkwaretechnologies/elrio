
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // Firestore / Auth must bypass the SW — caching or stale handlers break WebChannel (login, snapshots).
    {
      urlPattern:
        /^https:\/\/(firestore|content-firestore|securetoken|identitytoolkit|firebaseinstallations|firebase|www)\.googleapis\.com\/.*/i,
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

/** Map App Hosting FIREBASE_WEBAPP_CONFIG into NEXT_PUBLIC_* for client bundle inlining. */
function firebasePublicEnvFromWebapp(): Record<string, string> {
  const mappings: [string, string][] = [
    ['NEXT_PUBLIC_FIREBASE_API_KEY', 'apiKey'],
    ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'authDomain'],
    ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'projectId'],
    ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'storageBucket'],
    ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId'],
    ['NEXT_PUBLIC_FIREBASE_APP_ID', 'appId'],
    ['NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', 'measurementId'],
  ];
  const out: Record<string, string> = {};
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw) as Record<string, string | undefined>;
    for (const [envKey, jsonKey] of mappings) {
      if (!process.env[envKey] && parsed[jsonKey]) {
        out[envKey] = String(parsed[jsonKey]);
      }
    }
  } catch {
    // ignore malformed FIREBASE_WEBAPP_CONFIG
  }
  return out;
}

const nextConfig: NextConfig = {
  env: firebasePublicEnvFromWebapp(),
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
