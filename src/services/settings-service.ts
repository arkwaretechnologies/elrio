
import { db } from '@/lib/firebase/client';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { SystemSettings } from '@/lib/types';

const SETTINGS_COLLECTION = 'systemSettings';
const GENERAL_SETTINGS_DOC = 'general';

export async function getSystemSettings(): Promise<SystemSettings | null> {
  const settingsRef = doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC);
  const docSnap = await getDoc(settingsRef);

  if (docSnap.exists()) {
    return docSnap.data() as SystemSettings;
  }
  return null;
}

export async function updateSystemSettings(data: Partial<SystemSettings>): Promise<void> {
  const settingsRef = doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC);
  await setDoc(settingsRef, {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
