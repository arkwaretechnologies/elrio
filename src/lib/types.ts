/** Per-store dining table chip on the floor plan canvas (0–100% coordinates). */
export type FloorPlanTable = {
  id: string;
  label: string;
  xPct: number;
  yPct: number;
  /** Width as % of canvas (optional; defaults below). */
  widthPct?: number;
  /** Height as % of canvas (optional; defaults below). */
  heightPct?: number;
};

export const FLOOR_PLAN_TABLE_DEFAULT_WIDTH_PCT = 14;
export const FLOOR_PLAN_TABLE_DEFAULT_HEIGHT_PCT = 11;

export function floorPlanTableSize(t: Pick<FloorPlanTable, "widthPct" | "heightPct">) {
  return {
    widthPct: t.widthPct ?? FLOOR_PLAN_TABLE_DEFAULT_WIDTH_PCT,
    heightPct: t.heightPct ?? FLOOR_PLAN_TABLE_DEFAULT_HEIGHT_PCT,
  };
}

export type Store = {
  id: string;
  name: string;
  location?: string;
  floorPlanTables?: FloorPlanTable[];
};

export const unitsOfMeasurement = ['pcs', 'g', 'kg', 'mL', 'L', 'cups'] as const;
export type UnitOfMeasurement = typeof unitsOfMeasurement[number];

export type InventoryItem = {
  id: string;
  name: string;
  unit: UnitOfMeasurement;
  /** Default true. If false, sales log usage but do not decrement store stock (usage-only / non-inventoried SKU). */
  tracksStock?: boolean;
};

export type StoreInventory = {
  id: string; // Composite key like `${storeId}_${inventoryItemId}`
  storeId: string;
  inventoryItemId: string;
  stock: number;
  itemName: string; // Denormalized
  unit: UnitOfMeasurement; // Denormalized
  /** Denormalized from inventoryItems; default true when missing. */
  tracksStock?: boolean;
};


export type InventoryConsumption = {
  inventoryItemId: string;
  quantity: number;
  /** Default true. If false, sale logs consumption but does not decrement storeInventory. */
  deductStock?: boolean;
};

type StockTrackingMaster = Pick<InventoryItem, 'tracksStock'> | Pick<StoreInventory, 'tracksStock'> | null | undefined;

/** Row-level legacy `deductStock` and master `tracksStock` both must allow deduction. */
export function consumptionDeductsStock(c: InventoryConsumption, master?: StockTrackingMaster): boolean {
  const rowOk = c.deductStock !== false;
  const masterOk = master?.tracksStock !== false;
  return rowOk && masterOk;
}

export type ConfigurableProductOptions = {
  selectionLimit: number;
  allowedProductIds: string[]; // List of MenuItem IDs
};

export type ProductVariant = {
  id:string;
  name: string; // e.g., "Ube", "Cheese"
  price: number;
  inventoryConsumption: InventoryConsumption[];
  // This will be populated with the correct StoreInventory record
  inventoryItem?: StoreInventory;
  configurableOptions?: ConfigurableProductOptions;
  isPreOrder: boolean;
  isCustomPrice: boolean;
};

export type BaseProduct = {
  id: string;
  name: string; // e.g., "Torta"
  category: string;
  imageUrl: string;
  imagePath?: string;
  aiHint: string;
  variants: ProductVariant[];
  availableInStoreIds?: string[]; // New field for store availability
  blurDataURL?: string;
};


export type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  aiHint: string;
  inventoryConsumption: InventoryConsumption[];
  // This is populated client-side after fetching
  inventoryItem?: StoreInventory;
  // For variant selection
  baseProductId?: string;
  variantName?: string;
  configurableOptions?: ConfigurableProductOptions;
  isPreOrder: boolean;
  isCustomPrice: boolean;
};

export type SelectedConfigurationItem = {
    menuItemId: string;
    name: string;
    quantity: number;
    inventoryConsumption: InventoryConsumption[];
}

export type CartItem = {
  id: string; // This will be a composite key like `baseProductId_variantId` or unique for assorted boxes
  name: string; // Full name e.g., "Torta - Ube"
  price: number;
  quantity: number;
  imageUrl: string;
  // Info needed for stock management
  inventoryConsumption: InventoryConsumption[];
  // We need the original item for stock checks on quantity updates
  originalMenuItem?: MenuItem;
  baseProductId: string;
  variantId: string;
  // For configurable products
  configurableOptions?: ConfigurableProductOptions;
  selectedConfiguration?: SelectedConfigurationItem[];
  isPreOrder: boolean;
};

export type SeniorDiscountDetails = {
    items: {
        itemId: string;
        name: string;
        quantity: number;
    }[];
    vatExemptSales: number;
    totalDiscount: number;
}

/** Unpaid order held for later payment (not customer credit). */
export type OpenOrder = {
  id: string;
  storeId: string;
  items: CartItem[];
  manualDiscount: number;
  seniorDiscountDetails: SeniorDiscountDetails | null;
  subtotal: number;
  discount: number;
  total: number;
  tableId?: string | null;
  tableLabel?: string | null;
  note?: string | null;
  createdAt: Date;
  createdByUserId?: string | null;
  createdByName?: string | null;
};

export type SaleItem = {
    id: string;
    name: string;
    price: number;
    quantity: number;
    // For assorted items
    configuration?: SelectedConfigurationItem[] | null;
    isPreOrder: boolean;
}

export type RegularCustomer = {
    id: string;
    firstName: string;
    lastName: string;
    // creditBalance is now per store
    storeCredit: Record<string, number>; // Key: storeId, Value: balance
}

export type Sale = {
    id: string;
    storeId: string;
    items: SaleItem[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: 'Cash' | 'GCash' | 'On Credit';
    referenceNumber?: string | null;
    customerName?: string | null; // Keeps the name at time of sale
    specialInstructions?: string | null;
    timestamp: Date; // For regular sales, this is the creation time. For pre-orders, this is the pickup time.
    createdAt: Date; // The actual time the transaction was created.
    isPreOrder: boolean;
    seniorDiscountDetails?: SeniorDiscountDetails | null;
    phoneNumber?: string | null;
    pickupDate?: Date | null;
    amountPaid: number; // How much was paid for this specific transaction
    isPaidInFull: boolean;
    // For credit sales
    onCredit: boolean;
    regularCustomerId?: string | null;
    status: 'COMPLETED' | 'VOIDED';
    voidedAt?: Date | null;
    voidedBy?: string | null; // User ID
    tableId?: string | null;
    tableLabel?: string | null;
}

export type Payment = {
    id: string;
    customerId: string;
    storeId: string;
    amount: number;
    paymentDate: Date;
    notes?: string;
    saleId?: string; // Link to the sale being settled
};


export type ExpenseCategory = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  storeId: string;
  date: Date;
  description: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  notes?: string;
};

export type ConsignmentIncome = {
  id: string;
  storeId: string;
  date: Date;
  description: string;
  amount: number;
  notes?: string;
};


// --- User Management Types ---

export const roles = ['Cashier', 'Supervisor', 'Owner', 'Admin'] as const;
export type Role = typeof roles[number];

/** Matches POS sidebar areas (see `pos-layout` menu). Order follows the nav. */
export const permissions = {
  pos: {
    id: 'pos',
    label: 'Point of Sale',
    description: 'Sell from the register (main POS screen)',
  },
  tables: {
    id: 'tables',
    label: 'Tables',
    description: 'Floor plan and table service',
  },
  orders: {
    id: 'orders',
    label: 'Orders',
    description: 'Open orders and order management',
  },
  inventory: {
    id: 'inventory',
    label: 'Inventory',
    description: 'Stock and inventory items',
  },
  expenses: {
    id: 'expenses',
    label: 'Expenses',
    description: 'Record and review business expenses',
  },
  reports: {
    id: 'reports',
    label: 'Reports',
    description: 'Order history, sales, stock movement, and related reports',
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    description: 'System options and end of day',
  },
  users: {
    id: 'users',
    label: 'User Management',
    description: 'Manage users and permissions (Settings → User Management)',
  },
} as const;
export type PermissionId = keyof typeof permissions;

const PERMISSION_IDS = new Set(Object.keys(permissions) as PermissionId[]);

/** Drops unknown permission strings (e.g. legacy keys) so forms only persist current `PermissionId`s. */
export function sanitizePermissions(perms: string[]): PermissionId[] {
  return perms.filter((p): p is PermissionId => PERMISSION_IDS.has(p as PermissionId));
}

/**
 * Access checks for the three POS-area routes.
 * Legacy: users who only have `pos` (before tables/orders were split) keep all three until edited.
 */
export function canAccessPosRoute(
  perms: PermissionId[],
  route: 'register' | 'tables' | 'orders'
): boolean {
  const s = sanitizePermissions(perms as string[]);
  const set = new Set(s);
  const legacyPosBundle =
    set.has('pos') && !set.has('tables') && !set.has('orders');
  if (route === 'register') return set.has('pos');
  if (route === 'tables') return set.has('tables') || legacyPosBundle;
  return set.has('orders') || legacyPosBundle;
}

export type User = {
    id: string;
    fullName: string;
    username: string;
    password?: string; // Should be hashed in a real app
    role: Role;
    pin: string; // Stored as a plain string for now, should be hashed in a real app
    isActive: boolean;
    permissions: PermissionId[];
    accessibleStoreIds: string[];
    defaultStoreId: string;
};

// This maps roles to their default permissions.
export const rolePermissions: Record<Role, PermissionId[]> = {
  Cashier: ['pos', 'tables', 'orders'],
  Supervisor: [
    'pos',
    'tables',
    'orders',
    'inventory',
    'expenses',
    'reports',
    'settings',
    'users',
  ],
  Owner: [
    'pos',
    'tables',
    'orders',
    'inventory',
    'expenses',
    'reports',
    'settings',
    'users',
  ],
  Admin: [
    'pos',
    'tables',
    'orders',
    'inventory',
    'expenses',
    'reports',
    'settings',
    'users',
  ],
};

export type InventoryAdjustmentType = 'Restock' | 'Damaged' | 'Expired' | 'Count Correction' | 'Sale' | 'Void';
export const inventoryAdjustmentTypes: InventoryAdjustmentType[] = ['Restock', 'Damaged', 'Expired', 'Count Correction', 'Sale', 'Void'];

export type Category = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export type AddProductImage = {
    contentType: string;
    dataUri: string;
};

export type AddProductData = Omit<BaseProduct, 'id' | 'imageUrl' | 'aiHint' | 'variants' | 'blurDataURL'> & { 
    variants: (Omit<ProductVariant, 'inventoryItem'> & { isPreOrder: boolean, isCustomPrice: boolean })[];
    hasMultipleVariants: boolean;
    image?: AddProductImage;
    availableInStoreIds?: string[];
};

export type EodReport = {
    id: string; // YYYY-MM-DD-storeId
    storeId: string;
    date: Date;
    totalSales: number;
    totalDiscounts: number;
    netSales: number;
    paymentMethods: {
        Cash: number;
        GCash: number;
        'On Credit': number;
        cashFromSales?: number;
        cashFromPreOrderAdvances?: number;
        gcashFromNewSales?: number;
        cashFromSettlements?: number;
        gcashFromSettlements?: number;
    };
    totalOrders: number;
    transactions: Sale[];
    settlementPayments: Payment[];
    expenses: Expense[];
    totalExpenses: number;
    consignmentIncomes: ConsignmentIncome[];
    totalConsignmentIncome: number;
    generatedById: string; // User ID
    generatedByName: string; // User's full name
    generatedAt: Date;
};

export type SystemSettings = {
  eodReportRecipient?: string;
  updatedAt?: Date;
}
