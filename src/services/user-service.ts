
import { db } from '@/lib/firebase/client';
import { collection, getDocs, query, orderBy, addDoc, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import * as bcrypt from 'bcryptjs';

const saltRounds = 10;

export async function getUsers(): Promise<User[]> {
  const usersCollection = collection(db, 'users');
  const q = query(usersCollection, orderBy("fullName"));
  const snapshot = await getDocs(q);
  const users = snapshot.docs.map(doc => {
    const data = doc.data();
    // Ensure we don't send the password to the client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userData } = data;
    return {
      id: doc.id,
      ...userData,
    } as User;
  });
  return users;
}

export async function addUser(user: Omit<User, 'id'>): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password!, saltRounds);
    const userToCreate = { ...user, password: hashedPassword };

    const docRef = await addDoc(collection(db, 'users'), userToCreate);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userData } = user;
    return {
        id: docRef.id,
        ...userData
    } as User;
}

export async function updateUser(userId: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const dataToUpdate = { ...data };

    if (dataToUpdate.password) {
        dataToUpdate.password = await bcrypt.hash(dataToUpdate.password, saltRounds);
    } else {
        // Ensure we don't accidentally wipe out the password
        delete dataToUpdate.password;
    }

    await updateDoc(userRef, dataToUpdate);
}

export async function deleteUser(userId: string): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
}

interface UpdateUserProfileData {
    userId: string;
    currentPassword?: string;
    newPassword?: string;
    pin?: string;
}

export async function updateUserProfile({ userId, currentPassword, newPassword, pin }: UpdateUserProfileData): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        throw new Error("User not found.");
    }
    
    if (!currentPassword) {
        throw new Error("Current password is required to make any changes.");
    }

    const userData = userDoc.data() as User;
    const passwordMatch = await bcrypt.compare(currentPassword, userData.password || '');
    if (!passwordMatch) {
        throw new Error("The current password you entered is incorrect.");
    }

    const dataToUpdate: Partial<User> = {};

    if (newPassword) {
        dataToUpdate.password = await bcrypt.hash(newPassword, saltRounds);
    }

    if (pin !== undefined) {
        dataToUpdate.pin = pin;
    }

    if (Object.keys(dataToUpdate).length === 0) {
        // Nothing to update
        return;
    }

    await updateDoc(userRef, dataToUpdate);
}
