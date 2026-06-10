
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const clientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function hasExplicitFirebaseConfig(
  config: typeof clientConfig
): config is Required<typeof clientConfig> {
  return !!(config.apiKey && config.projectId && config.appId);
}

/**
 * IndexedDB + multi-tab persistence requires a real browser with LocalStorage.
 * Next.js SSR and some embedded / locked-down environments lack that; using
 * persistent cache there logs FirebaseError unimplemented and falls back anyway.
 */
function canUseFirestorePersistentCache(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof indexedDB === 'undefined') return false;
    const k = '__firestore_persist_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

// Initialize Firebase for the client.
// Local dev: NEXT_PUBLIC_FIREBASE_* from .env.local.
// App Hosting: apphosting.yaml env vars and/or initializeApp() with no args (FIREBASE_WEBAPP_CONFIG).
const clientApp = !getApps().length
  ? hasExplicitFirebaseConfig(clientConfig)
    ? initializeApp(clientConfig)
    : initializeApp()
  : getApp();

const db = initializeFirestore(clientApp, {
  localCache: canUseFirestorePersistentCache()
    ? persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      })
    : memoryLocalCache(),
});

const storage = getStorage(clientApp);

export { clientApp, db, storage };
