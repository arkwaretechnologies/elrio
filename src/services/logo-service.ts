import { APP_LOGO_PATH } from '@/lib/branding';
import { storage } from '@/lib/firebase/client';
import { ref, getDownloadURL } from 'firebase/storage';

const STORAGE_LOGO_PATH = 'El Rio Logo Transparent.png';

function staticLogoUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_APP_LOGO_URL?.trim();
  return u ? u : null;
}

export async function getLogoUrl(): Promise<string> {
  const fromEnv = staticLogoUrl();
  if (fromEnv) {
    return fromEnv;
  }

  if (process.env.NEXT_PUBLIC_ENABLE_FIREBASE_STORAGE_LOGO === 'true') {
    try {
      const imageRef = ref(storage, STORAGE_LOGO_PATH);
      return await getDownloadURL(imageRef);
    } catch {
      // fall through to bundled public asset
    }
  }

  return APP_LOGO_PATH;
}
