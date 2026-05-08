

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
  runTransaction,
  increment,
  WriteBatch,
  where,
  limit,
  getDoc,
  Timestamp,
  deleteField,
} from 'firebase/firestore';
import type { RegularCustomer, Sale, Payment } from '@/lib/types';
import { recordCustomerPayment, getPaymentsForCustomer } from './payment-service';

export async function getRegularCustomers(): Promise<RegularCustomer[]> {
  const customersCollection = collection(db, 'regularCustomers');
  // Order only by one field in the query to avoid needing a composite index.
  // We will sort by first name on the client.
  const q = query(customersCollection, orderBy("lastName"));
  const snapshot = await getDocs(q);
  const customers = snapshot.docs.map(doc => ({ 
    id: doc.id,
     ...doc.data(),
    storeCredit: doc.data().storeCredit || {}, // Ensure storeCredit exists
  } as RegularCustomer));
  
  // Perform secondary sort on the client side.
  customers.sort((a, b) => {
    if (a.lastName < b.lastName) return -1;
    if (a.lastName > b.lastName) return 1;
    return a.firstName.localeCompare(b.firstName);
  });

  return customers;
}

export async function searchRegularCustomers(searchQuery: string): Promise<RegularCustomer[]> {
  if (!searchQuery) {
    return [];
  }
  
  const customersCollection = collection(db, 'regularCustomers');
  
  // To handle various capitalizations, we'll try searching for a few common cases.
  // e.g., if user types "neil", we search for "neil", "Neil", and "NEIL".
  // A more robust solution involves storing lowercase versions of names in Firestore.
  const queryLower = searchQuery.toLowerCase();
  const queryUpper = searchQuery.toUpperCase();
  const queryCapitalized = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1).toLowerCase();

  const searchTerms = [...new Set([queryLower, queryUpper, queryCapitalized])];

  const queries = searchTerms.flatMap(term => [
      query(customersCollection, 
        orderBy('lastName'),
        where('lastName', '>=', term),
        where('lastName', '<=', term + '\uf8ff'),
        limit(5)
      ),
      query(customersCollection, 
        orderBy('firstName'),
        where('firstName', '>=', term),
        where('firstName', '<=', term + '\uf8ff'),
        limit(5)
      ),
  ]);

  const allSnapshots = await Promise.all(queries.map(q => getDocs(q)));
  
  const customersMap = new Map<string, RegularCustomer>();
  
  allSnapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
          if (!customersMap.has(doc.id)) {
              customersMap.set(doc.id, { id: doc.id, ...doc.data() } as RegularCustomer);
          }
      });
  });

  return Array.from(customersMap.values());
}


export async function addRegularCustomer(firstName: string, lastName: string): Promise<RegularCustomer> {
  const newCustomerData = {
    firstName,
    lastName,
    storeCredit: {}, // Initialize with an empty object
  };
  const docRef = await addDoc(collection(db, 'regularCustomers'), newCustomerData);
  return { id: docRef.id, ...newCustomerData };
}

export async function updateRegularCustomer(customerId: string, data: Partial<Omit<RegularCustomer, 'id' | 'storeCredit'>>): Promise<void> {
  const customerRef = doc(db, 'regularCustomers', customerId);
  await updateDoc(customerRef, data);
}

export async function deleteRegularCustomer(customerId: string): Promise<void> {
  const customerRef = doc(db, 'regularCustomers', customerId);
  await deleteDoc(customerRef);
}

export async function getTransactionsForCustomer(storeId: string, customerId: string): Promise<(Sale | Payment)[]> {
    // This query now fetches ALL sales linked to a regular customer in a specific store,
    // not just credit sales. This includes pre-orders and fully paid cash sales.
    const salesQuery = query(
        collection(db, 'sales'),
        where('storeId', '==', storeId),
        where('regularCustomerId', '==', customerId)
    );
    
    const [salesSnapshot, payments] = await Promise.all([
        getDocs(salesQuery),
        getPaymentsForCustomer(storeId, customerId)
    ]);
    
    const sales = salesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            timestamp: (data.timestamp as Timestamp).toDate(),
            createdAt: (data.createdAt as Timestamp)?.toDate(),
        } as Sale;
    });

    const allTransactions = [...sales, ...payments];

    allTransactions.sort((a, b) => {
        const dateA = 'createdAt' in a ? a.createdAt : a.paymentDate;
        const dateB = 'createdAt' in b ? b.createdAt : b.paymentDate;
        return dateA.getTime() - dateB.getTime();
    });

    return allTransactions;
}


// DEPRECATED - Use recordCustomerPayment in payment-service instead
export async function updateCustomerCreditForStore(storeId: string, customerId: string, amount: number): Promise<void> {
    const customerRef = doc(db, 'regularCustomers', customerId);
    
    await runTransaction(db, async (transaction) => {
        const customerDoc = await transaction.get(customerRef);
        if (!customerDoc.exists()) {
            throw new Error("Customer not found.");
        }
        
        const customerData = customerDoc.data() as RegularCustomer;
        const currentBalance = customerData.storeCredit?.[storeId] || 0;
        const newBalance = currentBalance + amount;
        
        const creditField = `storeCredit.${storeId}`;
        transaction.update(customerRef, {
            [creditField]: newBalance
        });
    });
}

// Resets credit for a specific store across all customers.
export function resetStoreCustomerCreditBalances(batch: WriteBatch, customerDocs: RegularCustomer[], storeId: string): void {
  customerDocs.forEach(customer => {
    if (customer.storeCredit && customer.storeCredit[storeId]) {
      const customerRef = doc(db, 'regularCustomers', customer.id);
      batch.update(customerRef, {
        [`storeCredit.${storeId}`]: deleteField()
      });
    }
  });
}
