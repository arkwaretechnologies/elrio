
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User, Store, StoreInventory } from '@/lib/types';
import { CakeLoader } from '@/components/cake-loader';
import { getStores } from '@/services/store-service';
import { getStoreInventory } from '@/services/inventory-service';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
  reloadUser: () => void;
  // Merged from StoreContext
  stores: Store[];
  currentStore: Store | null;
  setCurrentStore: (store: Store) => void;
  inventory: StoreInventory[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, _setCurrentStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<StoreInventory[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  const clearAuthAndStore = useCallback(() => {
    localStorage.removeItem('elrio-pos-user');
    localStorage.removeItem('elrio-pos-store');
    setUser(null);
    setStores([]);
    _setCurrentStore(null);
    setInventory([]);
  }, []);
  
  const logout = useCallback(() => {
    clearAuthAndStore();
    router.replace('/login');
    // Dispatch custom event to ensure all tabs log out
    window.dispatchEvent(new CustomEvent('elrio-pos-logout'));
  }, [router, clearAuthAndStore]);
  
  const initializeAuth = useCallback(async () => {
    setLoading(true);
    const storedUser = localStorage.getItem('elrio-pos-user');
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setUser(parsedUser);
        
        const allStores = await getStores();
        let userStores = allStores;
        
        if (parsedUser.role !== 'Admin' && parsedUser.role !== 'Owner') {
          userStores = allStores.filter(s => parsedUser.accessibleStoreIds.includes(s.id));
        }
        setStores(userStores);
        
        const storedStoreData = localStorage.getItem('elrio-pos-store');
        let storeToLoad = null;
        if (storedStoreData) {
            const storedStore = JSON.parse(storedStoreData);
            if (userStores.some(s => s.id === storedStore.id)) {
                storeToLoad = storedStore;
            }
        }
        
        if (!storeToLoad) {
            storeToLoad = userStores.find(s => s.id === parsedUser.defaultStoreId) || userStores[0] || null;
        }

        if (storeToLoad) {
          _setCurrentStore(storeToLoad);
        }

      } catch (error) {
        console.error("Auth initialization failed:", error);
        logout();
      }
    }
    setLoading(false);
  }, [logout]);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (currentStore) {
      setLoading(true);
      const q = collection(db, "storeInventory");
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const storeInv = snapshot.docs
          .map(doc => doc.data() as StoreInventory)
          .filter(item => item.storeId === currentStore.id);
        setInventory(storeInv);
        setLoading(false);
      }, (error) => {
        console.error("Failed to listen to inventory updates: ", error);
        setLoading(false);
      });
    } else {
      setInventory([]);
      if(!user) {
        setLoading(false);
      }
    }

    return () => unsubscribe();
  }, [currentStore, user]);

  const setCurrentStore = (store: Store) => {
    _setCurrentStore(store);
    localStorage.setItem('elrio-pos-store', JSON.stringify(store));
  };

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      const isLogoutEvent = event.type === 'elrio-pos-logout';
      const isStorageEvent = event.type === 'storage' && (event as StorageEvent).key === 'elrio-pos-user';
      if (isLogoutEvent || isStorageEvent) {
        initializeAuth();
      }
    };
    
    initializeAuth();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('elrio-pos-logout', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('elrio-pos-logout', handleStorageChange);
    };
  }, [initializeAuth]);
  
  useEffect(() => {
    if (loading) return;

    if (user) {
      if (pathname === '/login') {
        router.replace(user.role === 'Admin' || user.role === 'Owner' ? '/super-admin' : '/pos');
      }
    } else {
      if (pathname !== '/login') {
        router.replace('/login');
      }
    }
  }, [user, loading, pathname, router]);

  const value = { 
    user, 
    loading, 
    logout, 
    reloadUser: initializeAuth,
    stores,
    currentStore,
    setCurrentStore,
    inventory,
  };

  if (loading && !user && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground font-semibold tracking-wider">
          Initializing...
        </p>
      </div>
    );
  }
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
