
import { CategoryClient } from "@/components/category-client";
import { getCategories } from "@/services/category-service";

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="p-6">
      <CategoryClient initialCategories={categories} />
    </div>
  );
}
