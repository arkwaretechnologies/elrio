
"use client";

import { ProfileManagementClient } from "@/components/profile-management-client";
import { useAuth } from "@/context/auth-context";

export default function ProfilePage() {
    const { user } = useAuth();
    
    if (!user) {
        return null;
    }

    return (
        <div className="p-6">
            <ProfileManagementClient currentUser={user} />
        </div>
    );
}
