import { redirect } from 'next/navigation';

export default function OldInventoryItemsPage() {
  redirect('/inventory/inventory-items');
  return null;
}
