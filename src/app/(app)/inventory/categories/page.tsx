import { redirect } from 'next/navigation';

export default function OldCategoriesPage() {
  redirect('/settings/categories');
  return null;
}
