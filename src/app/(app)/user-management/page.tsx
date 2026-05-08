import { redirect } from 'next/navigation';

export default function OldUserManagementPage() {
  redirect('/settings/user-management');
  return null;
}
