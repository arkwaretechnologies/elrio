
"use client";

import React, { useState, useEffect } from 'react';
import { UserManagementClient } from "@/components/user-management-client";
import { getUsers } from "@/services/user-service";
import { useAuth } from '@/context/auth-context';
import { CakeLoader } from '@/components/cake-loader';
import type { User } from '@/lib/types';
import { redirect } from 'next/navigation';

export default function UserManagementPage() {
  const { user, currentStore } = useAuth();
  
  // This page is now only for non-admins. Admins use the one in /super-admin.
  // Redirect if an admin happens to land here.
  if (user?.role === 'Admin' || user?.role === 'Owner') {
    redirect('/super-admin/user-management');
  }

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers()
      .then(fetchedUsers => {
        setAllUsers(fetchedUsers);
      })
      .catch(error => {
        console.error("Failed to load users:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredUsers = React.useMemo(() => {
    // For other roles (like Supervisor) in the POS context:
    if (currentStore) {
      // 1. Filter by users accessible in the current store.
      // 2. Also, filter out any users who are Admins or Owners.
      return allUsers.filter(u => 
        u.accessibleStoreIds.includes(currentStore.id) && 
        u.role !== 'Admin' && 
        u.role !== 'Owner'
      );
    }
    
    // Default to empty if no store context
    return [];
  }, [allUsers, currentStore]);

  if (loading || !currentStore) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <UserManagementClient initialUsers={filteredUsers} />
    </div>
  );
}
