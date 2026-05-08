# Product Requirements Document: El Rio - POS

**Version:** 1.0
**Date:** 2024-08-01

## 1. Overview

El Rio - POS is a modern, intuitive Point of Sale (POS) system designed for bakeries and cafes. It provides a seamless interface for cashiers to process orders, manage menu items, and handle payments efficiently. The system is built with a focus on usability, speed, and real-time inventory tracking to support daily business operations.

## 2. Goals & Objectives

*   **Primary Goal:** To create a fast, reliable, and user-friendly POS system that streamlines the ordering and checkout process.
*   **Key Objectives:**
    *   Provide a clear and visually appealing menu for easy item selection.
    *   Enable efficient cart management, including quantity adjustments and item removal.
    *   Allow for flexible, manual discounts on a per-order basis.
    *   Offer simple inventory and category management to keep the menu up-to-date.
    *   Maintain a clean and consistent user interface that requires minimal training.

## 3. Core Features

### 3.1. Point of Sale (POS) Interface
- **Menu Grid:** Display all available products in a visual grid, showing the item's image, name, and price.
- **Category Filtering:** Allow the user to filter the menu by product categories (e.g., "Pastries," "Drinks") using a tab-based navigation.
- **Add to Cart:** Users can add items to the current order by clicking on them in the menu grid.
- **Low Stock Indicator:** Products with low stock levels are visually flagged in the menu.

### 3.2. Cart & Order Management
- **Current Order Display:** A dedicated panel shows all items in the current order, their quantities, and individual prices.
- **Quantity Adjustment:** Users can increment or decrement the quantity of each item directly within the cart.
- **Item Removal:** Users can remove individual items from the cart.
- **Subtotal Calculation:** The system automatically calculates and displays the subtotal before any discounts are applied.
- **Manual Discount:** Users can apply a specific monetary discount to the order total via a dialog box. The discount amount cannot exceed the subtotal.
- **Total Calculation:** The final order total is calculated by subtracting the discount from the subtotal.
- **Charge/Checkout:** A prominent "Charge" button finalizes the order, displays a confirmation toast, and clears the cart for the next transaction.

### 3.3. Inventory Management
- **Product Management:**
    - A dedicated view lists all products in a table, showing their image, name, category, price, and stock level.
    - Users can add new products through a form, including uploading a product image.
    - The system provides key statistics, such as total number of products, total inventory value, and a count of low-stock items.
    - A prominent alert highlights products that are critically low on stock.
- **Category Management (under Settings):**
    - Users can view a list of all product categories.
    - Users can add new categories with a name and an optional description.

### 3.4. Navigation & Layout
- **Sidebar Navigation:** A persistent sidebar allows navigation between the main sections: Point of Sale, Inventory, Reports, and Settings.
- **Collapsible Sections:** The "Inventory" and "Settings" menu items are collapsible, organizing sub-pages like "Products," "Categories," and "User Management" cleanly.
- **User Profile & Sign-out:** The sidebar includes a placeholder for the current user's information and a sign-out button.
- **Responsive Design:** The layout adapts to different screen sizes, with the sidebar transitioning to an off-canvas menu on mobile devices.

## 4. Design & Style Guidelines

-   **Color Palette:**
    -   **Primary:** Light orange (#FFB74D) - Warm and inviting.
    -   **Background:** Very light yellow (#FFF9E6) - Soft and clean.
    -   **Accent:** Muted red-orange (#FF8A65) - For key actions.
-   **Typography:**
    -   **Font:** 'PT Sans' for all headings and body text to ensure a modern, readable aesthetic.
-   **UI Components:**
    -   The interface utilizes pre-built, aesthetically pleasing components (ShadCN) with rounded corners and subtle shadows for a professional feel.
    -   Icons from `lucide-react` are used consistently to enhance usability and visual communication.
-   **Logo:** The application displays the El Rio logo in the sidebar header.

## 5. Future (Out of Scope for v1.0)
-   **Reports:** The "Reports" page is currently a placeholder and will be built out to provide sales analytics.
-   **User Management:** The "User Management" page is a placeholder and will be developed to handle different user roles and permissions.
-   **Edit/Delete Functionality:** While adding products and categories is functional, editing and deleting them needs to be fully implemented.
-   **Authentication:** The user profile is currently static. A full authentication system will be integrated.
