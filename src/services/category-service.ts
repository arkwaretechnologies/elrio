import { db } from '@/lib/firebase/client';
import { collection, getDocs, query, orderBy, addDoc, doc, updateDoc, deleteDoc, where, getCountFromServer } from 'firebase/firestore';
import type { Category } from '@/lib/types';

export async function getCategories(): Promise<Category[]> {
  const categoriesCollection = collection(db, 'categories');
  const q = query(categoriesCollection, orderBy("name"));
  const categoriesSnapshot = await getDocs(q);
  const categories = categoriesSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      description: data.description,
      icon: data.icon,
    } as Category;
  });
  return categories;
}

export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const docRef = await addDoc(collection(db, 'categories'), category);
    return {
        id: docRef.id,
        ...category
    }
}

export async function updateCategory(categoryId: string, data: Partial<Omit<Category, 'id'>>): Promise<void> {
    const categoryRef = doc(db, 'categories', categoryId);
    await updateDoc(categoryRef, data);
}

export async function deleteCategory(categoryId: string): Promise<void> {
    // First, find the category name
    const categoryRef = doc(db, 'categories', categoryId);
    const categorySnap = await getDocs(query(collection(db, 'categories'), where('__name__', '==', categoryId)));
    if (categorySnap.empty) {
        throw new Error("Category not found.");
    }
    const categoryName = categorySnap.docs[0].data().name;

    // Check if any base products use this category
    const baseProductsRef = collection(db, 'baseProducts');
    const qBase = query(baseProductsRef, where("category", "==", categoryName));
    const baseProductsCount = (await getCountFromServer(qBase)).data().count;

    if (baseProductsCount > 0) {
       throw new Error(`Cannot delete category. It is used by ${baseProductsCount} product(s). Please update or delete those products first.`);
    }
    
    // Check for simple products (that don't have a baseProductId)
    const simpleProductsRef = collection(db, 'menuItems');
    const qSimple = query(simpleProductsRef, where("category", "==", categoryName), where("baseProductId", "==", null));
    const simpleProductsCount = (await getCountFromServer(qSimple)).data().count;

    const totalUsage = baseProductsCount + simpleProductsCount;
    if (totalUsage > 0) {
        throw new Error(`Cannot delete category. It is used by ${totalUsage} product(s). Please update or delete those products first.`);
    }

    await deleteDoc(categoryRef);
}
