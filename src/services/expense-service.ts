
import { db } from '@/lib/firebase/client';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import type { Expense, ExpenseCategory } from '@/lib/types';


// --- Expense Categories ---

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const categoriesCollection = collection(db, 'expenseCategories');
  const q = query(categoriesCollection, orderBy("name"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
}

export async function addExpenseCategory(categoryName: string): Promise<ExpenseCategory> {
    const docRef = await addDoc(collection(db, 'expenseCategories'), { name: categoryName });
    return { id: docRef.id, name: categoryName };
}

// --- Expenses ---

export async function getExpenses(storeId: string): Promise<Expense[]> {
  if (!storeId) return [];
  const expensesCollection = collection(db, 'expenses');
  // The query is simplified to filter by storeId first.
  // Sorting is done on the client-side to avoid needing a composite index.
  const q = query(expensesCollection, where("storeId", "==", storeId));
  const snapshot = await getDocs(q);
  
  const expenses = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      date: (data.date as Timestamp).toDate(),
    } as Expense;
  });

  // Sort by date descending in the application code.
  return expenses.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function addExpense(expenseData: Omit<Expense, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'expenses'), {
    ...expenseData,
    date: Timestamp.fromDate(new Date(expenseData.date)),
  });
  return docRef.id;
}

export async function updateExpense(expenseId: string, expenseData: Partial<Omit<Expense, 'id'>>): Promise<void> {
  const expenseRef = doc(db, 'expenses', expenseId);
  const dataToUpdate: any = { ...expenseData };
  if (expenseData.date) {
    dataToUpdate.date = Timestamp.fromDate(new Date(expenseData.date));
  }
  await updateDoc(expenseRef, dataToUpdate);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const expenseRef = doc(db, 'expenses', expenseId);
  await deleteDoc(expenseRef);
}


export async function resetAllExpenses(storeId: string): Promise<void> {
  const expensesQuery = query(collection(db, 'expenses'), where("storeId", "==", storeId));
  const snapshot = await getDocs(expensesQuery);
  
  if (snapshot.empty) {
    return;
  }
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}
