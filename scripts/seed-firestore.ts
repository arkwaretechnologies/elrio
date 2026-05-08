/**
 * Seeds El Rio Firestore: same collections/field shapes as your legacy POS (see screenshots).
 *
 * Prerequisites (first match wins):
 *   - `GOOGLE_APPLICATION_CREDENTIALS` = absolute path to the downloaded JSON, OR
 *   - `serviceAccountKey.json` in the project root, OR
 *   - Any `*firebase-adminsdk-*.json` file Firebase downloaded (e.g. el-rio-16c18-firebase-adminsdk-....json), OR
 *   - `FIREBASE_SERVICE_ACCOUNT_KEY` = full JSON string of the service account.
 *
 * Run from project root:
 *   npm run seed:firestore
 *
 * Safe to run multiple times: uses fixed document IDs and merge for the store only where noted.
 *
 * Ensures these collections exist (Firestore needs ≥1 document per collection):
 *   baseProducts, categories, consignmentIncomes, eodReports, expenseCategories, expenses,
 *   inventoryItems, inventoryLogs, menuItems, payments, regularCustomers, sales,
 *   storeInventory, stores, systemSettings
 *
 * Also seeds `mail` (readme doc) and `users/seed-user-owner`. `terminals` is not used by this codebase.
 */

import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import * as admin from 'firebase-admin';

loadEnv({ path: path.join(process.cwd(), '.env') });
loadEnv({ path: path.join(process.cwd(), '.env.local') });

const STORE_ID = 'main-branch';
/** Placeholder transactional docs use this storeId so they do not appear under `main-branch` in the app. */
const SEED_STORE_SENTINEL = 'seed-sentinel';

function resolveServiceAccountKeyPath(): string | null {
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && fs.existsSync(gac)) {
    return gac;
  }

  const legacy = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(legacy)) {
    return legacy;
  }

  const root = process.cwd();
  const adminsdk = fs
    .readdirSync(root)
    .filter((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));
  if (adminsdk.length === 1) {
    return path.join(root, adminsdk[0]);
  }
  if (adminsdk.length > 1) {
    throw new Error(
      `Multiple *firebase-adminsdk*.json files in ${root}. Keep one, or set GOOGLE_APPLICATION_CREDENTIALS to the file to use.`
    );
  }

  return null;
}

function initFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.firestore();
  }

  let credential: admin.credential.Credential;

  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (envJson) {
    try {
      credential = admin.credential.cert(JSON.parse(envJson) as admin.ServiceAccount);
    } catch {
      const keyPath = resolveServiceAccountKeyPath();
      if (keyPath) {
        console.warn(
          'FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON; using service account file instead:',
          keyPath
        );
        const raw = fs.readFileSync(keyPath, 'utf8');
        credential = admin.credential.cert(JSON.parse(raw) as admin.ServiceAccount);
      } else {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT_KEY in .env is not valid single-line JSON, and no *firebase-adminsdk*.json was found. Remove or fix the env line, or add the JSON key file to the project root.'
        );
      }
    }
  } else {
    const keyPath = resolveServiceAccountKeyPath();
    if (keyPath) {
      const raw = fs.readFileSync(keyPath, 'utf8');
      credential = admin.credential.cert(JSON.parse(raw) as admin.ServiceAccount);
    } else {
      throw new Error(
        'Missing credentials: add *firebase-adminsdk*.json or serviceAccountKey.json in the project root, or set GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT_KEY.'
      );
    }
  }

  admin.initializeApp({ credential });
  return admin.firestore();
}

/** Matches legacy category docs: name, description, icon (Lucide icon name). */
const CATEGORIES: { id: string; name: string; description: string; icon: string }[] = [
  { id: 'cat-burgers', name: 'Burgers', description: 'Burgers & sandwiches', icon: 'Sandwich' },
  { id: 'cat-chicken', name: 'Chicken', description: 'Fried & grilled chicken', icon: 'Drumstick' },
  { id: 'cat-rice-meals', name: 'Rice Meals', description: 'Rice plates & value meals', icon: 'UtensilsCrossed' },
  { id: 'cat-sides', name: 'Sides', description: 'Fries, sides, add-ons', icon: 'Salad' },
  { id: 'cat-drinks', name: 'Drinks', description: 'Soft drinks & cold beverages', icon: 'CupSoda' },
  { id: 'cat-cookies', name: 'Cookies', description: '', icon: 'Cookie' },
  { id: 'cat-bread-rolls', name: 'Bread rolls', description: '', icon: 'Croissant' },
  { id: 'cat-other', name: 'Other', description: '', icon: 'ShoppingBasket' },
];

/** expenseCategories: `{ name }` only (same as console). */
const EXPENSE_CATEGORIES = [
  { id: 'exp-rent', name: 'Rent' },
  { id: 'exp-utilities', name: 'Utilities' },
  { id: 'exp-supplies', name: 'Supplies & packaging' },
  { id: 'exp-food-cost', name: 'Food cost / restock' },
  { id: 'exp-marketing', name: 'Marketing' },
  { id: 'exp-salaries', name: 'Salaries & wages' },
  { id: 'exp-maintenance', name: 'Maintenance' },
  { id: 'exp-other', name: 'Others' },
];

/** inventoryItems: name, unit (+ optional stock from legacy UI — app uses storeInventory for live stock). */
const INVENTORY_ITEMS: { id: string; name: string; unit: string; stock?: number }[] = [
  { id: 'inv-bun', name: 'Burger bun', unit: 'pcs', stock: 0 },
  { id: 'inv-patty', name: 'Beef patty', unit: 'pcs', stock: 0 },
  { id: 'inv-cheese', name: 'Cheese slice', unit: 'pcs', stock: 0 },
  { id: 'inv-chicken', name: 'Chicken fillet', unit: 'pcs', stock: 0 },
  { id: 'inv-rice', name: 'Rice (portion)', unit: 'cups', stock: 0 },
  { id: 'inv-fries', name: 'Fries (portion)', unit: 'pcs', stock: 0 },
  { id: 'inv-chocochip-mix', name: 'Chocochip cookie mix', unit: 'pcs', stock: 0 },
  { id: 'inv-bread-dough', name: 'Bread dough (portion)', unit: 'pcs', stock: 0 },
];

type MenuSeed = {
  id: string;
  name: string;
  category: string;
  price: number;
  aiHint: string;
  inventoryConsumption: { inventoryItemId: string; quantity: number }[];
};

const MENU_ITEMS: MenuSeed[] = [
  {
    id: 'menu-classic-burger',
    name: 'Classic Burger',
    category: 'Burgers',
    price: 89,
    aiHint: 'burgers classic burger',
    inventoryConsumption: [
      { inventoryItemId: 'inv-bun', quantity: 1 },
      { inventoryItemId: 'inv-patty', quantity: 1 },
    ],
  },
  {
    id: 'menu-cheese-burger',
    name: 'Cheese Burger',
    category: 'Burgers',
    price: 99,
    aiHint: 'burgers cheese',
    inventoryConsumption: [
      { inventoryItemId: 'inv-bun', quantity: 1 },
      { inventoryItemId: 'inv-patty', quantity: 1 },
      { inventoryItemId: 'inv-cheese', quantity: 1 },
    ],
  },
  {
    id: 'menu-chicken-rice',
    name: 'Chicken with Rice',
    category: 'Rice Meals',
    price: 115,
    aiHint: 'chicken rice meal',
    inventoryConsumption: [
      { inventoryItemId: 'inv-chicken', quantity: 1 },
      { inventoryItemId: 'inv-rice', quantity: 1 },
    ],
  },
  {
    id: 'menu-fries',
    name: 'French Fries (Large)',
    category: 'Sides',
    price: 55,
    aiHint: 'sides fries',
    inventoryConsumption: [{ inventoryItemId: 'inv-fries', quantity: 1 }],
  },
  {
    id: 'menu-soda',
    name: 'Soda (Medium)',
    category: 'Drinks',
    price: 45,
    aiHint: 'drinks soda',
    inventoryConsumption: [],
  },
  {
    id: 'menu-iced-tea',
    name: 'Iced Tea',
    category: 'Drinks',
    price: 35,
    aiHint: 'drinks iced tea',
    inventoryConsumption: [],
  },
];

/** baseProducts shape: name, category, aiHint, availableInStoreIds, optional imagePath */
const BASE_PRODUCT_ID = 'bp-deluxe-burger';
const BASE_CHOCOCHIP_ID = 'bp-chocochip-cookies';
const BASE_CINNAMON_ID = 'bp-cinnamon-buns';
const DELUXE_VARIANTS: {
  id: string;
  variantName: string;
  price: number;
  inventoryConsumption: { inventoryItemId: string; quantity: number }[];
}[] = [
  {
    id: 'menu-dlx-single',
    variantName: 'Single',
    price: 95,
    inventoryConsumption: [
      { inventoryItemId: 'inv-bun', quantity: 1 },
      { inventoryItemId: 'inv-patty', quantity: 1 },
    ],
  },
  {
    id: 'menu-dlx-meal',
    variantName: 'Meal',
    price: 129,
    inventoryConsumption: [
      { inventoryItemId: 'inv-bun', quantity: 1 },
      { inventoryItemId: 'inv-patty', quantity: 1 },
      { inventoryItemId: 'inv-fries', quantity: 1 },
    ],
  },
];

async function seed() {
  const db = initFirebaseAdmin();
  const batch = db.batch();
  const ownerPasswordHash = bcrypt.hashSync('password', 10);

  const storeRef = db.collection('stores').doc(STORE_ID);
  batch.set(
    storeRef,
    {
      name: 'El Rio - Main Counter',
      location: 'Fast food — main branch',
    },
    { merge: true }
  );

  for (const c of CATEGORIES) {
    batch.set(db.collection('categories').doc(c.id), {
      name: c.name,
      description: c.description,
      icon: c.icon,
    });
  }

  for (const e of EXPENSE_CATEGORIES) {
    batch.set(db.collection('expenseCategories').doc(e.id), { name: e.name });
  }

  for (const inv of INVENTORY_ITEMS) {
    batch.set(db.collection('inventoryItems').doc(inv.id), {
      name: inv.name,
      unit: inv.unit,
      tracksStock: true,
      ...(inv.stock !== undefined ? { stock: inv.stock } : {}),
    });
  }

  for (const inv of INVENTORY_ITEMS) {
    const sid = `${STORE_ID}_${inv.id}`;
    batch.set(db.collection('storeInventory').doc(sid), {
      storeId: STORE_ID,
      inventoryItemId: inv.id,
      itemName: inv.name,
      unit: inv.unit,
      stock: 200,
      tracksStock: true,
    });
  }

  for (const m of MENU_ITEMS) {
    batch.set(db.collection('menuItems').doc(m.id), {
      name: m.name,
      category: m.category,
      price: m.price,
      isPreOrder: false,
      isCustomPrice: false,
      aiHint: m.aiHint,
      inventoryConsumption: m.inventoryConsumption,
      configurableOptions: null,
      baseProductId: null,
      variantName: null,
      availableInStoreIds: [],
    });
  }

  batch.set(db.collection('baseProducts').doc(BASE_PRODUCT_ID), {
    name: 'Deluxe Burger',
    category: 'Burgers',
    aiHint: 'burgers deluxe combo',
    availableInStoreIds: [STORE_ID],
  });

  batch.set(db.collection('baseProducts').doc(BASE_CHOCOCHIP_ID), {
    name: 'Chocochip Cookies',
    category: 'Cookies',
    aiHint: 'other chocochip',
    // No imagePath until you upload to Storage — avoids storage/object-not-found
    availableInStoreIds: [STORE_ID],
  });

  batch.set(db.collection('baseProducts').doc(BASE_CINNAMON_ID), {
    name: 'Cinnamon',
    category: 'Bread rolls',
    aiHint: 'bread rolls cinnamon',
    availableInStoreIds: [STORE_ID],
  });

  batch.set(db.collection('menuItems').doc('menu-chocochip-std'), {
    baseProductId: BASE_CHOCOCHIP_ID,
    variantName: 'Standard',
    name: 'Chocochip Cookies - Standard',
    category: 'Cookies',
    price: 45,
    isPreOrder: false,
    isCustomPrice: false,
    aiHint: 'other chocochip',
    inventoryConsumption: [{ inventoryItemId: 'inv-chocochip-mix', quantity: 1 }],
    configurableOptions: null,
    availableInStoreIds: [STORE_ID],
  });

  batch.set(db.collection('menuItems').doc('menu-cinnamon-b'), {
    baseProductId: BASE_CINNAMON_ID,
    variantName: 'Cinnamon B',
    name: 'Cinnamon - Cinnamon B',
    category: 'Bread rolls',
    price: 155,
    isPreOrder: false,
    isCustomPrice: false,
    aiHint: 'bread cinnamon',
    inventoryConsumption: [{ inventoryItemId: 'inv-bread-dough', quantity: 1 }],
    configurableOptions: null,
    availableInStoreIds: [STORE_ID],
  });

  for (const v of DELUXE_VARIANTS) {
    batch.set(db.collection('menuItems').doc(v.id), {
      baseProductId: BASE_PRODUCT_ID,
      variantName: v.variantName,
      name: `Deluxe Burger - ${v.variantName}`,
      category: 'Burgers',
      price: v.price,
      isPreOrder: false,
      isCustomPrice: false,
      aiHint: 'burgers deluxe',
      inventoryConsumption: v.inventoryConsumption,
      configurableOptions: null,
      availableInStoreIds: [STORE_ID],
    });
  }

  const t0 = admin.firestore.Timestamp.fromMillis(0);
  const tNow = admin.firestore.FieldValue.serverTimestamp();

  batch.set(db.collection('sales').doc('seed-placeholder-sales'), {
    storeId: SEED_STORE_SENTINEL,
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    paymentMethod: 'Cash',
    referenceNumber: null,
    customerName: null,
    specialInstructions: null,
    timestamp: t0,
    createdAt: t0,
    isPreOrder: false,
    seniorDiscountDetails: null,
    phoneNumber: null,
    pickupDate: null,
    amountPaid: 0,
    isPaidInFull: true,
    onCredit: false,
    regularCustomerId: null,
    status: 'COMPLETED',
    voidedAt: null,
    voidedBy: null,
  });

  batch.set(db.collection('payments').doc('seed-placeholder-payments'), {
    customerId: '',
    storeId: SEED_STORE_SENTINEL,
    amount: 0,
    paymentDate: t0,
    notes: 'Collection initializer — safe to delete',
    saleId: null,
  });

  batch.set(db.collection('expenses').doc('seed-placeholder-expenses'), {
    storeId: SEED_STORE_SENTINEL,
    date: t0,
    description: 'Collection initializer',
    amount: 0,
    categoryId: 'exp-other',
    categoryName: 'Others',
    notes: 'Safe to delete',
  });

  batch.set(db.collection('consignmentIncomes').doc('seed-placeholder-consignment'), {
    storeId: SEED_STORE_SENTINEL,
    date: t0,
    description: 'Collection initializer',
    amount: 0,
    notes: 'Safe to delete',
  });

  batch.set(db.collection('eodReports').doc('seed-placeholder-eod'), {
    storeId: SEED_STORE_SENTINEL,
    date: t0,
    totalSales: 0,
    totalDiscounts: 0,
    netSales: 0,
    paymentMethods: { Cash: 0, GCash: 0, 'On Credit': 0 },
    totalOrders: 0,
    transactions: [],
    settlementPayments: [],
    expenses: [],
    totalExpenses: 0,
    consignmentIncomes: [],
    totalConsignmentIncome: 0,
    generatedById: 'seed-init',
    generatedByName: 'Seed',
    generatedAt: t0,
  });

  batch.set(db.collection('inventoryLogs').doc('seed-placeholder-invlog'), {
    storeId: SEED_STORE_SENTINEL,
    inventoryItemId: 'inv-bun',
    inventoryItemName: 'Burger bun',
    adjustment: 0,
    type: 'Count Correction',
    notes: 'Collection initializer — filtered out for real stores',
    timestamp: tNow,
    unit: 'pcs',
  });

  batch.set(db.collection('regularCustomers').doc('seed-regular-customer-template'), {
    firstName: 'Template',
    lastName: 'Customer (delete in CRM)',
    storeCredit: {},
  });

  const settingsRef = db.collection('systemSettings').doc('general');
  batch.set(
    settingsRef,
    {
      eodReportRecipient: '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(db.collection('mail').doc('seed-mail-readme'), {
    note: 'Placeholder doc so `mail` exists. Real Trigger Email payloads use `to` + `message`. App outbound email is disabled by default.',
  });

  batch.set(db.collection('users').doc('seed-user-owner'), {
    fullName: 'El Rio Owner',
    username: 'owner',
    password: ownerPasswordHash,
    role: 'Owner',
    pin: '1234',
    isActive: true,
    permissions: [
      'pos',
      'tables',
      'orders',
      'inventory',
      'expenses',
      'reports',
      'settings',
      'users',
    ],
    accessibleStoreIds: [STORE_ID],
    defaultStoreId: STORE_ID,
  });

  await batch.commit();
  console.log('Firestore seed completed successfully.');
  console.log(`Store: stores/${STORE_ID}`);
  console.log(
    `Categories: ${CATEGORIES.length}, inventory items: ${INVENTORY_ITEMS.length}, menuItems: ${MENU_ITEMS.length} simple + variants (Deluxe, Chocochip, Cinnamon), baseProducts: 3`
  );
  console.log(
    `Placeholder docs (storeId "${SEED_STORE_SENTINEL}"): sales, payments, expenses, consignmentIncomes, eodReports, inventoryLogs.`
  );
  console.log('Also: regularCustomers template, mail readme, users/seed-user-owner (login: owner / password — change in production).');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
