
'use server';
/**
 * @fileOverview A flow for adding a new product to the menu.
 * - addProduct - A function that handles creating a new product and its variants.
 * - AddProductInput - The input type for the addProduct function.
 * - MenuItem - The return type for the addProduct function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { MenuItem, AddProductData, AddProductImage, InventoryItem } from '@/lib/types';
import { collection, addDoc, getDocs, where, query, writeBatch, doc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { run } from 'genkit';

const AddProductInputSchema = z.object({
  name: z.string().describe('The name of the product.'),
  category: z.string().describe('The category of the product.'),
  price: z.number().describe('The price of the product.'),
  inventoryItemId: z.string().describe('The ID of the inventory item it consumes.'),
  quantityConsumed: z.number().int().describe('The quantity of the inventory item consumed per sale.'),
  image: z.object({
    contentType: z.string(),
    dataUri: z.string().describe("A photo of the product, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  }).optional(),
});

export type AddProductInput = z.infer<typeof AddProductInputSchema>;

// This is a one-time migration function. It will find all old pre-order items,
// create a corresponding inventory item for them, and convert them to standard items.
const migratePreOrderItems = async () => {
    return run('migrate-pre-orders', async () => {
        const menuItemsRef = collection(db, 'menuItems');
        const inventoryItemsRef = collection(db, 'inventoryItems');

        // Check if migration has already run to prevent duplicate executions
        const migrationCheck = await getDocs(query(inventoryItemsRef, where("name", "==", "MIGRATION_FLAG_COMPLETE")));
        if (!migrationCheck.empty) {
            console.log("Pre-order migration has already been completed. Skipping.");
            return;
        }

        const q = query(menuItemsRef, where("isPreOrder", "==", true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No pre-order items to migrate.");
            // Set flag even if there's nothing to do, to prevent re-running this check.
            await addDoc(inventoryItemsRef, { name: "MIGRATION_FLAG_COMPLETE", unit: "pcs" });
            return;
        }

        const batch = writeBatch(db);

        for (const doc of snapshot.docs) {
            const menuItem = doc.data() as MenuItem;
            
            // 1. Create a new inventory item with the same name
            const newInventoryItemRef = await addDoc(inventoryItemsRef, {
                name: menuItem.name,
                unit: 'pcs', // Default to 'pcs'
                tracksStock: true,
            });

            // 2. Update the menu item to be a standard item linked to the new inventory item
            batch.update(doc.ref, {
                isPreOrder: false,
                inventoryConsumption: [{
                    inventoryItemId: newInventoryItemRef.id,
                    quantity: 1,
                }]
            });
        }
        
        // Add a flag to mark that the migration is complete
        const flagRef = doc(inventoryItemsRef, 'migration_flag');
        batch.set(flagRef, { name: "MIGRATION_FLAG_COMPLETE", unit: "pcs", migratedAt: new Date() });

        await batch.commit();
        console.log(`Successfully migrated ${snapshot.size} pre-order items.`);
    });
};


export async function addProduct(input: AddProductInput): Promise<MenuItem> {
  // The migration will be triggered here. It's safe to run multiple times
  // as it has a flag to prevent re-execution.
  await migratePreOrderItems();
  
  return addProductFlow(input);
}

const addProductFlow = ai.defineFlow(
  {
    name: 'addProductFlow',
    inputSchema: AddProductInputSchema,
    outputSchema: z.custom<MenuItem>(),
  },
  async (productData) => {
    let imageUrl = 'https://placehold.co/300x200.png';
    let imagePath = '';

    if (productData.image) {
        imagePath = `menu-items/${productData.name.replace(/\s+/g, '-')}-${Date.now()}`;
        const storageRef = ref(storage, imagePath);
        const snapshot = await uploadString(storageRef, productData.image.dataUri, 'data_url', {
            contentType: productData.image.contentType
        });
        imageUrl = await getDownloadURL(snapshot.ref);
    }
    
    const docRef = await addDoc(collection(db, 'menuItems'), {
      name: productData.name,
      category: productData.category,
      price: productData.price,
      imageUrl: imageUrl, // Store the final URL
      imagePath: imagePath, // Store the path for future reference/deletion
      aiHint: `${productData.category.toLowerCase()} ${productData.name.toLowerCase().split(' ').slice(0,1)}`,
      inventoryConsumption: [{
          inventoryItemId: productData.inventoryItemId,
          quantity: productData.quantityConsumed,
      }]
    });

    const newMenuItem: MenuItem = {
      id: docRef.id,
      name: productData.name,
      category: productData.category,
      price: productData.price,
      imageUrl: imageUrl,
      aiHint: `${productData.category.toLowerCase()} ${productData.name.toLowerCase().split(' ').slice(0,1)}`,
      inventoryConsumption: [{
          inventoryItemId: productData.inventoryItemId,
          quantity: productData.quantityConsumed,
      }]
    };
    
    return newMenuItem;
  }
);
