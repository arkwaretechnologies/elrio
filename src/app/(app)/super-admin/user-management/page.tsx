
"use client";

import React, { useState, useEffect } from 'react';
import { UserManagementClient } from "@/components/user-management-client";
import { getUsers } from "@/services/user-service";
import { CakeLoader } from '@/components/cake-loader';
import type { User } from '@/lib/types';

export default function SuperAdminUserManagementPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <CakeLoader />
        <p className="mt-4 text-lg text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <UserManagementClient initialUsers={allUsers} />
    </div>
  );
}
