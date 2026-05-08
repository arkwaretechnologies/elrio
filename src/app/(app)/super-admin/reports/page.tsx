
import { redirect } from 'next/navigation';

export default function AdminReportsPage() {
  redirect('/super-admin/reports/sales');
  return null;
}
