
import { db } from '@/lib/firebase/client';
import { FirebaseError } from 'firebase/app';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import * as bcrypt from 'bcryptjs';
import type { User } from '@/lib/types';
import { rolePermissions } from '@/lib/types';

const saltRounds = 10;

function rethrowFirestore(err: unknown): never {
  if (err instanceof FirebaseError) {
    if (err.code === 'permission-denied') {
      throw new Error(
        'Firestore blocked this request (permission denied). In Firebase Console → Firestore → Rules, allow reads on `users` for your login flow, or deploy open rules for development.'
      );
    }
    if (err.code === 'unavailable' || err.code === 'failed-precondition') {
      throw new Error(
        'Cannot reach Firestore. If you use the installed PWA, update the app (rebuild + hard refresh) or unregister the service worker. If this persists after an update, confirm Firebase client config (NEXT_PUBLIC_FIREBASE_*) is set for the live build.'
      );
    }
  }
  throw err;
}

export async function login(username: string, password: string): Promise<User | null> {
  try {
  // Special case for initial admin login
  if (username === 'admin' && password === 'password') {
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where("username", "==", "admin"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // First time admin logs in, create the account with a hashed password
      // And also create the first default store
      const storeRef = doc(collection(db, 'stores'), 'main-branch');
      await setDoc(storeRef, { name: 'Main Branch', location: 'Default Location' });
      
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const adminUser: Omit<User, 'id'> = {
        fullName: 'Admin',
        username: 'admin',
        password: hashedPassword,
        role: 'Admin',
        pin: '',
        isActive: true,
        permissions: rolePermissions.Admin, // This now correctly includes 'expenses'
        accessibleStoreIds: [storeRef.id],
        defaultStoreId: storeRef.id,
      };
      const docRef = doc(usersCollection, 'initial-admin'); // Use a predictable ID
      await setDoc(docRef, adminUser);
      return { id: docRef.id, ...adminUser };
    }
    // If admin already exists, fall through to the normal login flow
  }

  const usersCollection = collection(db, 'users');
  const q = query(usersCollection, where("username", "==", username));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log("No such user!");
    return null;
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data() as User;

  if (!userData.isActive) {
      throw new Error("This account is inactive. Please contact an administrator.");
  }

  const passwordMatch = await bcrypt.compare(password, userData.password || '');
  if (!passwordMatch) {
    console.log("Password does not match!");
    return null;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userToReturn } = userData;

  return { id: userDoc.id, ...userToReturn } as User;
  } catch (e) {
    rethrowFirestore(e);
  }
}

export async function verifySupervisorPin(storeId: string, pin: string): Promise<boolean> {
  if (!pin || pin.length !== 4) return false;

  const usersCollection = collection(db, 'users');
  const q = query(
    usersCollection,
    where('role', 'in', ['Supervisor', 'Admin', 'Owner']),
    where('pin', '==', pin),
    where('isActive', '==', true),
    where('accessibleStoreIds', 'array-contains', storeId)
  );

  const snapshot = await getDocs(q);
  
  return !snapshot.empty;
}
