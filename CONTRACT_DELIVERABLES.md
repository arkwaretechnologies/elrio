
# El Rio - POS - Contract Deliverables

This document outlines the features and functionalities delivered for the El Rio - POS application.

---

## 1. Core System & Layout

- **Progressive Web App (PWA)**: The application is installable on desktop and mobile devices for an app-like experience and offline access.
- **Responsive Design**: The user interface adapts seamlessly from large desktop monitors to tablets and mobile phones.
- **Authentication**: Secure login system for registered users.
- **Role-Based Access Control**:
    - **Admin/Owner**: Full access to all features, including system-wide settings and reports for all stores.
    - **Supervisor**: Full access within assigned stores, including EOD reporting and user management.
    - **Cashier**: Access limited to the Point of Sale and core operational functions.
- **Store Switching**: Admins and users with access to multiple stores can easily switch between different branches from the sidebar.

---

## 2. Point of Sale (POS) Interface

- **Visual Menu Grid**: Products are displayed in a visually appealing grid with images, names, and prices.
- **Category Filtering**: A quick-filter bar allows cashiers to navigate between product categories (e.g., "Torta", "Drinks").
- **Product Search**: Instantly search for products by name.
- **Variant Support**:
    - **Single Items**: Products like "Single Torta" can be added directly to the cart.
    - **Multi-Variant Products**: For products with options (e.g., different flavors or sizes), a selection dialog appears.
    - **Assorted/Configurable Boxes**: For items like "Box of 12", a dialog allows the cashier to select the specific combination of items to include.
- **Real-time Stock Display**: The available quantity for each inventoried item is displayed on the menu grid.

---

## 3. Cart & Checkout Management

- **Dynamic Cart**: A dedicated panel shows all items in the current order, with the ability to increment, decrement, or remove items.
- **Financial Calculations**: The system automatically calculates the subtotal, discounts, and final total in real-time.
- **Discounting System**:
    - **Manual Discount**: Apply a specific monetary discount to an order, requiring supervisor PIN authorization for non-admins.
    - **Senior Citizen Discount**: Apply a compliant 20% senior discount by selecting the specific items consumed by the senior citizen. The system automatically handles VAT calculations.
- **Flexible Checkout Process**:
    - **Payment Methods**: Accept payments via Cash, GCash, or charge to a regular customer's credit account.
    - **Pre-order Functionality**: Mark an order as a pre-order, capturing customer name, phone number, and a future pick-up date.
    - **Special Instructions**: Add notes or special instructions to any order.
- **Transaction Success**: A clear, final dialog confirms the transaction details, including the change to be given to the customer.

---

## 4. Inventory & Product Administration

- **Product Management**: A centralized interface for admins to create, edit, and delete all base products and their variants.
    - Define product name, category, image, and availability across different stores.
    - Configure variants with unique names, prices, and inventory consumption rules.
- **Inventory Item Master List**: A global list of all raw materials and stockable items (e.g., "Torta Piece", "Coffee Beans").
- **Store-Level Inventory Management**:
    - View current stock levels for all items within a specific store.
    - Manually adjust stock levels with clear reasons (e.g., "Restock", "Damaged", "Count Correction").
- **Category Management**: Create and manage product categories, each with a unique name and icon.

---

## 5. Expense & Consignment Management

- **Expense Tracking**:
    - Record business expenses with a description, amount, date, and category.
    - Create and manage custom expense categories.
    - Filter expenses by date range and category.
- **Consignment Income Tracking**:
    - Record income from consignment goods with a description, amount, and date.
    - This income is correctly included in the End of Day sales calculations.

---

## 6. Customer Relationship Management (CRM)

- **Regular Customer Database**: Manage a list of regular customers.
- **Store-Specific Credit**: Track customer credit balances on a per-store basis.
- **Transaction History**: View a detailed history of all sales and payments for a specific customer within the selected store.
- **Credit Payments**: Record payments made by customers to settle their outstanding credit balances.

---

## 7. Reporting & Analytics

- **Admin & POS Views**: Reports are available for individual stores in the POS and aggregated in the Super Admin dashboard.
- **End of Day (EOD) Report**:
    - A comprehensive summary of the day's performance, including gross sales, net sales, discounts, expenses, and consignment income.
    - Detailed breakdown of cash collected vs. electronic payments.
    - Once the day is "closed" by a supervisor, the report is finalized.
    - **Download & Email**: Finalized reports can be downloaded as an `.ods` spreadsheet file or emailed to a configured recipient.
- **Sales Report**: Visualize revenue over time with a bar chart and view key metrics like total orders and average order value.
- **Order History**: A complete log of all transactions, with the ability to view item details and void sales (with supervisor permission).
- **Peak Hours Report**: A chart showing which hours of the day are busiest in terms of transaction volume and revenue.
- **Stock Movement Report**: Identifies fast-moving and slow-moving products based on sales volume over a selected period.
- **Inventory Logs**: A detailed audit trail of every stock adjustment, whether from a sale, restock, or manual correction.
- **Pre-orders Calendar**: A monthly calendar view showing all scheduled pre-orders, with the ability to click on a day to view and manage pick-ups.

---

## 8. User & System Management

- **User Management**: Admins and supervisors can create, edit, and deactivate user accounts.
- **Permission System**: Assign roles (Admin, Owner, Supervisor, Cashier) with pre-defined, overridable permissions for fine-grained access control.
- **Profile Management**: Individual users can update their own password.
- **System Settings (Admin)**:
    - Configure the recipient email address for EOD reports.
    - Perform bulk operations, like assigning all products to a new store.
    - Access dangerous data-reset functions (e.g., reset inventory, clear all transactional data) with confirmation prompts.
    - Backup and export all system data to an Excel file.
