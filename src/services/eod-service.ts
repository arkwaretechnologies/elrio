

import { db } from '@/lib/firebase/client';
import { collection, getDocs, query, where, Timestamp, doc, getDoc, setDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, addDays, isSameDay, isValid } from 'date-fns';
import type { Sale, EodReport, StoreInventory, Expense, Payment, ConsignmentIncome, BaseProduct } from '@/lib/types';
import * as XLSX from 'xlsx';
import { getMenuItems, getMenuItemsAsBaseProducts } from './menu-service';

export async function getSalesForDate(storeId: string, date: Date): Promise<Sale[]> {
  if (!storeId) return [];

  const start = startOfDay(date);
  const end = endOfDay(date);

  const salesCollection = collection(db, 'sales');
  const q = query(
    salesCollection,
    where('createdAt', '>=', start),
    where('createdAt', '<=', end),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate(),
        createdAt: (data.createdAt as Timestamp)?.toDate() || (data.timestamp as Timestamp).toDate(),
      } as Sale;
    })
    .filter(sale => sale.storeId === storeId); 
}

export async function getEodReport(storeId: string, date: Date): Promise<EodReport | null> {
  const reportId = `${format(date, 'yyyy-MM-dd')}_${storeId}`;
  const reportRef = doc(db, 'eodReports', reportId);
  const docSnap = await getDoc(reportRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      date: (data.date as Timestamp).toDate(),
      generatedAt: (data.generatedAt as Timestamp).toDate(),
      transactions: data.transactions.map((tx: any) => ({
        ...tx,
        timestamp: (tx.timestamp as Timestamp).toDate(),
        createdAt: (tx.createdAt as Timestamp)?.toDate() || (tx.timestamp as Timestamp).toDate(),
        pickupDate: tx.pickupDate ? (tx.pickupDate as Timestamp).toDate() : null,
      })),
       expenses: (data.expenses || []).map((ex: any) => ({
        ...ex,
        date: ex.date instanceof Timestamp ? ex.date.toDate() : new Date(ex.date),
      })),
       consignmentIncomes: (data.consignmentIncomes || []).map((inc: any) => ({
        ...inc,
        date: inc.date instanceof Timestamp ? inc.date.toDate() : new Date(inc.date),
      })),
       settlementPayments: (data.settlementPayments || []).map((p: any) => ({
        ...p,
        paymentDate: (p.paymentDate as Timestamp).toDate(),
      })),
    } as EodReport;
  }
  return null;
}

export async function createEodReport(
  storeId: string,
  reportData: Omit<EodReport, 'id' | 'generatedAt'>
): Promise<EodReport> {
  const reportId = `${format(reportData.date, 'yyyy-MM-dd')}_${storeId}`;
  const reportRef = doc(db, 'eodReports', reportId);

  const finalReport: Omit<EodReport, 'id'> = {
    ...reportData,
    generatedAt: new Date(),
  };

  await setDoc(reportRef, finalReport);

  return { id: reportId, ...finalReport };
}

export async function deleteEodReport(reportId: string): Promise<void> {
    const reportRef = doc(db, 'eodReports', reportId);
    await deleteDoc(reportRef);
}


interface GenerateEodReportFileParams {
  report: EodReport;
  inventory: StoreInventory[];
  storeName: string;
}

export async function generateEodReportFile({ report, inventory, storeName }: GenerateEodReportFileParams): Promise<{ fileData: Buffer; fileName: string; }> {
  
  const workbook = XLSX.utils.book_new();

  // --- Fetch all product definitions for category lookup ---
  const allProducts = await getMenuItemsAsBaseProducts(report.storeId);
  const productCategoryMap = new Map<string, string>();
  allProducts.forEach(p => {
    productCategoryMap.set(p.id, p.category);
    p.variants.forEach(v => {
      productCategoryMap.set(v.id, p.category); // Map variant ID to base product category
      productCategoryMap.set(`${p.id}_${v.id}`, p.category); // Map composite key
    });
  });

  
  const onCreditSettlements = (report.settlementPayments || []).filter(p => !p.saleId);
  const preOrderSettlements = (report.settlementPayments || []).filter(p => !!p.saleId);

  const cashFromOnCreditSettlements = onCreditSettlements
        .filter(p => !p.notes || !p.notes.toLowerCase().includes('gcash'))
        .reduce((sum, p) => sum + p.amount, 0);

  const gcashFromOnCreditSettlements = onCreditSettlements
        .filter(p => p.notes && p.notes.toLowerCase().includes('gcash'))
        .reduce((sum,p) => sum + p.amount, 0);

  const sameDayPreOrderSettlements = preOrderSettlements.filter(p => {
        const correspondingSale = report.transactions.find(s => s.id === p.saleId);
        return correspondingSale && isSameDay(new Date(correspondingSale.createdAt), new Date(p.paymentDate));
    }).reduce((sum, p) => sum + p.amount, 0);

  const sameDayCashPreOrderSettlements = preOrderSettlements.filter(p => {
        const correspondingSale = report.transactions.find(s => s.id === p.saleId);
        return correspondingSale && isSameDay(new Date(correspondingSale.createdAt), new Date(p.paymentDate)) && (!p.notes || !p.notes.toLowerCase().includes('gcash'));
    }).reduce((sum, p) => sum + p.amount, 0);

  const cashFromPreOrderSettlements = preOrderSettlements
        .filter(p => !p.notes || !p.notes.toLowerCase().includes('gcash'))
        .reduce((sum, p) => sum + p.amount, 0) - sameDayCashPreOrderSettlements;

  const sameDayGCashPreOrderSettlements = preOrderSettlements.filter(p => {
        const correspondingSale = report.transactions.find(s => s.id === p.saleId);
        return correspondingSale && isSameDay(new Date(correspondingSale.createdAt), new Date(p.paymentDate)) && (p.notes && p.notes.toLowerCase().includes('gcash'));
    }).reduce((sum, p) => sum + p.amount, 0);
  
  const gcashFromPreOrderSettlements = preOrderSettlements
        .filter(p => p.notes && p.notes.toLowerCase().includes('gcash'))
        .reduce((sum, p) => sum + p.amount, 0) - sameDayGCashPreOrderSettlements;
  
  const totalOnCreditSettlements = onCreditSettlements.reduce((sum,p) => sum + p.amount, 0);
  const totalPreOrderSettlements = preOrderSettlements.reduce((sum, p) => sum + p.amount, 0);

  const summaryData = [
    { Key: 'Date', Value: format(new Date(report.date), 'PPP') },
    { Key: 'Store', Value: storeName },
    { Key: 'Generated By', Value: report.generatedByName },
    { Key: 'Generated At', Value: format(new Date(report.generatedAt), 'PPP p') },
    { Key: '', Value: '' },
    { Key: 'Total Gross Sales (Sales + Consignment)', Value: report.totalSales },
    { Key: 'Total Discounts', Value: report.totalDiscounts },
    { Key: 'Net Sales', Value: report.netSales },
    { Key: '', Value: '' },
    { Key: 'Cash from Sales', Value: report.paymentMethods.cashFromSales || 0 },
    { Key: 'Cash from Consignment', Value: report.totalConsignmentIncome || 0},
    { Key: 'Cash from On-Credit Settlements', Value: cashFromOnCreditSettlements },
    { Key: 'Cash from Pre-order Settlements', Value: cashFromPreOrderSettlements },
    { Key: 'Total Cash Collected', Value: report.paymentMethods.Cash || 0 },
    { Key: 'GCash Payments', Value: report.paymentMethods.GCash || 0 },
    { Key: 'On Credit (New Receivables)', Value: report.paymentMethods['On Credit'] || 0 },
    { Key: 'Total Orders', Value: report.totalOrders },
    { Key: '', Value: '' },
    { Key: 'Total Expenses', Value: report.totalExpenses },
    { Key: '', Value: '' },
    { Key: 'DAILY NET SALES SUMMARY', Value: ''},
    { Key: 'Total Cash Collected', Value: (report.paymentMethods.Cash || 0) },
    { Key: 'Total GCash Collected', Value: (report.paymentMethods.GCash || 0) },
    { Key: 'Total Expenses', Value: -report.totalExpenses },
    { Key: 'Net Sales of the Day', Value: (report.paymentMethods.Cash || 0) + (report.paymentMethods.GCash || 0) - report.totalExpenses },
  ];
  const summaryWs = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
  XLSX.utils.book_append_sheet(workbook, summaryWs, 'Summary');

  const transactionsData = report.transactions.map(t => ({
    'Time': format(t.createdAt, 'p'),
    'Customer': t.customerName || 'N/A',
    'Items': t.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
    'Payment': t.paymentMethod,
    'Discount': t.discount,
    'Total': t.total,
    'Amount Paid': t.amountPaid
  }));
  const transactionsWs = XLSX.utils.json_to_sheet(transactionsData);
  XLSX.utils.book_append_sheet(workbook, transactionsWs, 'Transactions');
  
  if (report.settlementPayments && report.settlementPayments.length > 0) {
    const paymentsData = report.settlementPayments.map(p => ({
        'Payment Time': format(p.paymentDate, 'p'),
        'Amount': p.amount,
        'Notes': p.notes || '',
    }));
    const paymentsWs = XLSX.utils.json_to_sheet(paymentsData);
    XLSX.utils.book_append_sheet(workbook, paymentsWs, 'Settlements');
  }

  const preOrdersData = report.transactions.filter(t => t.isPreOrder).map(t => ({
    'Order Time': format(t.createdAt, 'p'),
    'Pickup Date': t.pickupDate && isValid(new Date(t.pickupDate)) ? format(new Date(t.pickupDate), 'PPP') : 'N/A',
    'Customer': t.customerName || 'N/A',
    'Items': t.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
    'Total': t.total,
    'Amount Paid': t.amountPaid,
  }));
  if (preOrdersData.length > 0) {
    const preOrdersWs = XLSX.utils.json_to_sheet(preOrdersData);
    XLSX.utils.book_append_sheet(workbook, preOrdersWs, 'Pre-orders');
  }

  const salesByItem = new Map<string, { name: string; quantity: number; revenue: number }>();
  report.transactions.forEach(sale => {
    sale.items.forEach(item => {
      const existing = salesByItem.get(item.id) || { name: item.name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
      salesByItem.set(item.id, existing);
    });
  });
  const salesByItemData = Array.from(salesByItem.values()).sort((a,b) => b.quantity - a.quantity);
  const salesByItemWs = XLSX.utils.json_to_sheet(salesByItemData);
  XLSX.utils.book_append_sheet(workbook, salesByItemWs, 'Sales By Item');
  
  // --- New "Sales By Category" Sheet ---
  const salesByCategory = new Map<string, number>();
  let totalRevenueForCategoryReport = 0;

  report.transactions.forEach(sale => {
    if (sale.status === 'VOIDED') return;
    
    totalRevenueForCategoryReport += sale.total;
    
    sale.items.forEach(item => {
      // The item.id is a composite key like `baseProductId_variantId`.
      // We look it up in our comprehensive map.
      const category = productCategoryMap.get(item.id) || 'Uncategorized';
      
      const currentCategoryTotal = salesByCategory.get(category) || 0;
      salesByCategory.set(category, currentCategoryTotal + (item.price * item.quantity));
    });
  });

  const salesByCategoryData = Array.from(salesByCategory.entries())
    .map(([category, total]) => ({
      Category: category,
      'Total Sales (PHP)': total,
      'Percentage (%)': parseFloat(((total / totalRevenueForCategoryReport) * 100).toFixed(2)) || 0,
    }))
    .sort((a, b) => b['Total Sales (PHP)'] - a['Total Sales (PHP)']);

  const salesByCategoryWs = XLSX.utils.json_to_sheet(salesByCategoryData);
  XLSX.utils.book_append_sheet(workbook, salesByCategoryWs, 'Sales By Category');
  // --- End of New Sheet ---


  if (report.expenses && report.expenses.length > 0) {
    const expensesData = report.expenses.map(e => ({
        'Date': format(e.date, 'PPP'),
        'Description': e.description,
        'Category': e.categoryName,
        'Amount': e.amount,
        'Notes': e.notes || ''
    }));
    const expensesWs = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(workbook, expensesWs, 'Expenses');
  }
  
  if (report.consignmentIncomes && report.consignmentIncomes.length > 0) {
    const incomesData = report.consignmentIncomes.map(i => ({
        'Date': format(i.date, 'PPP'),
        'Description': i.description,
        'Amount': i.amount,
        'Notes': i.notes || ''
    }));
    const incomesWs = XLSX.utils.json_to_sheet(incomesData);
    XLSX.utils.book_append_sheet(workbook, incomesWs, 'Consignment Incomes');
  }

  const stockData = inventory.map(i => ({
    'Item Name': i.itemName,
    'Stock': i.stock,
    'Unit': i.unit,
  })).sort((a,b) => a['Item Name'].localeCompare(b['Item Name']));
  const stockWs = XLSX.utils.json_to_sheet(stockData);
  XLSX.utils.book_append_sheet(workbook, stockWs, 'Remaining Stock');

  const tomorrow = addDays(new Date(report.date), 1);
  const salesCollection = collection(db, 'sales');
  const allPreOrdersQuery = query(
    salesCollection,
    where("storeId", "==", report.storeId),
    where("isPreOrder", "==", true)
  );

  const allPreOrdersSnapshot = await getDocs(allPreOrdersQuery);
  const tomorrowOrders = allPreOrdersSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data(), pickupDate: doc.data().pickupDate.toDate() } as Sale))
    .filter(sale => sale.pickupDate && isSameDay(sale.pickupDate, tomorrow));
  
  const tomorrowOrdersData = tomorrowOrders.map(t => {
    const balance = t.total - (t.amountPaid || 0);
    return {
      'Customer': t.customerName || 'N/A',
      'Items': t.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
      'Total': t.total,
      'Amount Paid': t.amountPaid || 0,
      'Balance': balance,
      'Status': balance <= 0 ? 'Paid' : 'Unpaid',
      'Contact': t.phoneNumber || '',
      'Notes': t.specialInstructions || '',
    };
  });
  
  if (tomorrowOrdersData.length > 0) {
      const tomorrowOrdersWs = XLSX.utils.json_to_sheet(tomorrowOrdersData);
      XLSX.utils.book_append_sheet(workbook, tomorrowOrdersWs, 'Orders for Tomorrow');
  }
  
  const fileData = XLSX.write(workbook, { bookType: 'ods', type: 'buffer' });
  const fileName = `EOD_Report_${storeName}_${format(new Date(report.date), 'yyyy-MM-dd')}.ods`;
  
  return { fileData, fileName };
}
