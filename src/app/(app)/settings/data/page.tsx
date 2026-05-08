
import { redirect } from 'next/navigation';

// This page is obsolete and has been replaced by /app/data-management.
// Redirecting to maintain compatibility with old bookmarks or links.
export default function OldDataManagementPage() {
  redirect('/data-management');
  return null;
}
