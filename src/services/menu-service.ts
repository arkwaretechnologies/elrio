





import { db, storage } from '@/lib/firebase/client';
import { FirebaseError } from 'firebase/app';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, writeBatch, addDoc, deleteDoc, where, setDoc, arrayUnion } from 'firebase/firestore';
import { ref, getDownloadURL, uploadString, deleteObject } from 'firebase/storage';
import type { MenuItem, StoreInventory, BaseProduct, ProductVariant, AddProductData, InventoryConsumption, ConfigurableProductOptions } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const PLAUSIBLE_BLUR_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAI8wNPvd7POQAAAABJRU5ErkJggg==';

function logStorageImageError(error: unknown) {
  if (error instanceof FirebaseError && error.code === 'storage/object-not-found') {
    return;
  }
  console.error('Error getting image URL:', error);
}

async function getInventoryItemMap(storeId: string): Promise<Map<string, StoreInventory>> {
  const inventoryCollection = collection(db, 'storeInventory');
  const q = query(inventoryCollection, where("storeId", "==", storeId));
  const snapshot = await getDocs(q);
  const map = new Map<string, StoreInventory>();
  snapshot.docs.forEach(doc => {
    const data = doc.data() as StoreInventory;
    map.set(data.inventoryItemId, data);
  });
  return map;
}

export async function getMenuItems(storeId?: string): Promise<MenuItem[]> {
  const menuCollection = collection(db, 'menuItems');
  const q = query(menuCollection, orderBy("name"));
  const menuSnapshot = await getDocs(q);

  const inventoryItemMap = storeId ? await getInventoryItemMap(storeId) : new Map();

  const menuItemsPromises = menuSnapshot.docs.map(async (menuItemDoc) => {
    const data = menuItemDoc.data();
    
    // For store-specific filtering
    if (storeId && data.availableInStoreIds && !data.availableInStoreIds.includes(storeId)) {
        return null;
    }
    
    let imageUrl = 'https://placehold.co/300x200.png';
    const baseProductDoc = data.baseProductId ? await getDoc(doc(db, 'baseProducts', data.baseProductId)) : null;
    const baseProductData = baseProductDoc?.exists() ? baseProductDoc.data() : null;

    const imagePath = baseProductData?.imagePath || data.imagePath;

    if (imagePath) {
         try {
            const imageRef = ref(storage, imagePath);
            imageUrl = await getDownloadURL(imageRef);
        } catch (error) {
            logStorageImageError(error);
        }
    }
    
    const inventoryConsumption: InventoryConsumption[] = data.inventoryConsumption || [];

    if (!inventoryConsumption.length && data.inventoryItemId && data.quantityConsumed) {
        inventoryConsumption.push({
            inventoryItemId: data.inventoryItemId,
            quantity: data.quantityConsumed,
        });
    }

    const firstConsumption = inventoryConsumption.length > 0 ? inventoryConsumption[0] : null;

    return {
      id: menuItemDoc.id,
      name: baseProductData ? `${baseProductData.name} - ${data.variantName}` : data.name,
      category: baseProductData?.category || data.category,
      price: data.price,
      imageUrl: imageUrl,
      aiHint: baseProductData?.aiHint || data.aiHint || '',
      inventoryConsumption: inventoryConsumption,
      isPreOrder: data.isPreOrder ?? false,
      configurableOptions: data.configurableOptions,
      inventoryItem: firstConsumption ? inventoryItemMap.get(firstConsumption.inventoryItemId) : undefined,
      baseProductId: data.baseProductId,
      variantName: data.variantName,
    } as MenuItem;
  });

  const menuItems = (await Promise.all(menuItemsPromises)).filter(p => p !== null) as MenuItem[];
  return menuItems;
}

export async function getMenuItemsAsBaseProducts(storeId?: string): Promise<BaseProduct[]> {
    const baseProductsCollection = collection(db, 'baseProducts');
    const menuItemsCollection = collection(db, 'menuItems');

    const baseProductsSnapshot = await getDocs(query(baseProductsCollection, orderBy("name")));
    const menuItemsSnapshot = await getDocs(query(menuItemsCollection, orderBy("name")));
    
    const inventoryItemMap = storeId ? await getInventoryItemMap(storeId) : new Map();

    const menuItemsByBaseId = new Map<string, any[]>();
    const standaloneProducts: BaseProduct[] = [];

    for (const doc of menuItemsSnapshot.docs) {
        const data = doc.data();
        if (data.baseProductId) {
            if (!menuItemsByBaseId.has(data.baseProductId)) {
                menuItemsByBaseId.set(data.baseProductId, []);
            }
            menuItemsByBaseId.get(data.baseProductId)!.push({ id: doc.id, ...data });
        } else {
            let imageUrl = data.imagePath ? await getDownloadURL(ref(storage, data.imagePath)).catch(() => 'https://placehold.co/300x200.png') : 'https://placehold.co/300x200.png';
            
            const consumption = data.inventoryConsumption || (data.inventoryItemId ? [{ 
              inventoryItemId: data.inventoryItemId, 
              quantity: data.quantityConsumed,
            }] : []);

            const variants: ProductVariant[] = [{
                id: doc.id,
                name: data.variantName || 'Default',
                price: data.price,
                inventoryConsumption: consumption,
                isPreOrder: data.isPreOrder ?? false,
                configurableOptions: data.configurableOptions,
                inventoryItem: consumption[0] ? inventoryItemMap.get(consumption[0].inventoryItemId) : undefined,
            }];

            standaloneProducts.push({
                id: doc.id,
                name: data.name,
                category: data.category,
                imageUrl,
                imagePath: data.imagePath,
                aiHint: data.aiHint || '',
                variants: variants,
                availableInStoreIds: data.availableInStoreIds,
                blurDataURL: PLAUSIBLE_BLUR_DATA_URL,
            });
        }
    }

    const complexProductsPromises = baseProductsSnapshot.docs.map(async bpDoc => {
        const bpData = bpDoc.data();
        
        // Filter by store if storeId is provided
        if (storeId && bpData.availableInStoreIds && bpData.availableInStoreIds.length > 0 && !bpData.availableInStoreIds.includes(storeId)) {
            return null;
        }

        const variantsData = menuItemsByBaseId.get(bpDoc.id) || [];
        
        const variants: ProductVariant[] = variantsData.map((item: any) => {
            const consumption = item.inventoryConsumption || [];
            const inventoryItem = consumption[0] ? inventoryItemMap.get(consumption[0].inventoryItemId) : undefined;
            return {
                id: item.id,
                name: item.variantName,
                price: item.price,
                inventoryConsumption: consumption,
                isPreOrder: item.isPreOrder ?? false,
                configurableOptions: item.configurableOptions,
                inventoryItem: inventoryItem,
            };
        });
        
        let imageUrl = bpData.imagePath ? await getDownloadURL(ref(storage, bpData.imagePath)).catch(() => 'https://placehold.co/300x200.png') : 'https://placehold.co/300x200.png';

        return {
            id: bpDoc.id,
            name: bpData.name,
            category: bpData.category,
            variants,
            imageUrl,
            imagePath: bpData.imagePath,
            aiHint: bpData.aiHint || '',
            availableInStoreIds: bpData.availableInStoreIds,
            blurDataURL: PLAUSIBLE_BLUR_DATA_URL,
        } as BaseProduct;
    });

    const complexProducts = (await Promise.all(complexProductsPromises)).filter(p => p !== null) as BaseProduct[];
    
    // Filter standalone products by store
    const filteredStandaloneProducts = storeId 
      ? standaloneProducts.filter(p => !p.availableInStoreIds || p.availableInStoreIds.length === 0 || p.availableInStoreIds.includes(storeId))
      : standaloneProducts;

    const allProducts = [...complexProducts, ...filteredStandaloneProducts];
    allProducts.sort((a, b) => a.name.localeCompare(b.name));

    return allProducts;
}

async function uploadImage(image: { contentType: string, dataUri: string }, name: string): Promise<{imageUrl: string, imagePath: string}> {
    const imagePath = `menu-items/${name.replace(/\s+/g, '-')}-${Date.now()}`;
    const storageRef = ref(storage, imagePath);
    const snapshot = await uploadString(storageRef, image.dataUri, 'data_url', {
        contentType: image.contentType
    });
    const imageUrl = await getDownloadURL(snapshot.ref);
    return { imageUrl, imagePath };
}

export async function addProduct(productData: AddProductData): Promise<BaseProduct> {
    const batch = writeBatch(db);

    const isSimpleProduct = !productData.hasMultipleVariants;
    let imageInfo: { imageUrl: string, imagePath: string } | undefined;

    if (productData.image) {
        imageInfo = await uploadImage(productData.image, productData.name);
    }

    if (isSimpleProduct) {
        const variant = productData.variants[0];
        const menuItemRef = doc(collection(db, 'menuItems'));
        
        const menuItemData: any = {
            name: productData.name,
            category: productData.category,
            price: variant.price,
            isPreOrder: variant.isPreOrder ?? false,
            aiHint: `${productData.category.toLowerCase()} ${productData.name.toLowerCase().split(' ').slice(0,1)}`,
            inventoryConsumption: variant.inventoryConsumption || [],
            configurableOptions: variant.configurableOptions || null,
            baseProductId: null,
            variantName: null,
            availableInStoreIds: productData.availableInStoreIds || [],
        };
        
        if (imageInfo?.imagePath) {
            menuItemData.imagePath = imageInfo.imagePath;
        }

        batch.set(menuItemRef, menuItemData);

        await batch.commit();

        return {
            id: menuItemRef.id,
            name: productData.name,
            category: productData.category,
            variants: [{...variant, id: menuItemRef.id}],
            imageUrl: imageInfo?.imageUrl || 'https://placehold.co/300x200.png',
            imagePath: imageInfo?.imagePath,
            aiHint: `${productData.category.toLowerCase()} ${productData.name.toLowerCase().split(' ').slice(0,1)}`,
            availableInStoreIds: productData.availableInStoreIds,
            blurDataURL: PLAUSIBLE_BLUR_DATA_URL,
        };

    } else {
        const baseProductRef = doc(collection(db, 'baseProducts'));
        
        const baseProductData: any = {
            name: productData.name,
            category: productData.category,
            aiHint: `${productData.category.toLowerCase()} ${productData.name.toLowerCase().split(' ').slice(0,1)}`,
            availableInStoreIds: productData.availableInStoreIds || [],
        };

        if (imageInfo?.imagePath) {
            baseProductData.imagePath = imageInfo.imagePath;
        }

        batch.set(baseProductRef, baseProductData);

        const finalVariants: ProductVariant[] = [];
        productData.variants.forEach(variant => {
            const menuItemRef = doc(collection(db, 'menuItems'));
            
            const variantData: any = {
                baseProductId: baseProductRef.id,
                variantName: variant.name,
                price: variant.price,
                inventoryConsumption: variant.inventoryConsumption || [],
                isPreOrder: variant.isPreOrder ?? false,
                name: `${productData.name} - ${variant.name}`,
                category: productData.category,
                configurableOptions: variant.configurableOptions || null,
            };

            batch.set(menuItemRef, variantData);
            finalVariants.push({ ...variant, id: menuItemRef.id });
        });

        await batch.commit();

        return {
            id: baseProductRef.id,
            name: productData.name,
            category: productData.category,
            variants: finalVariants,
            imageUrl: imageInfo?.imageUrl || 'https://placehold.co/300x200.png',
            imagePath: imageInfo?.imagePath,
            aiHint: `${productData.category.toLowerCase()} ${productData.name.toLowerCase().split(' ').slice(0,1)}`,
            availableInStoreIds: productData.availableInStoreIds,
            blurDataURL: PLAUSIBLE_BLUR_DATA_URL,
        };
    }
}


export async function updateProduct(productId: string, productData: AddProductData): Promise<BaseProduct> {
    const batch = writeBatch(db);
    const baseProductRef = doc(db, 'baseProducts', productId);
    const baseProductSnap = await getDoc(baseProductRef);

    const isUpdatingToSimple = !productData.hasMultipleVariants;
    const wasComplexProduct = baseProductSnap.exists();
    
    let imageInfo: { imageUrl: string, imagePath?: string } | undefined;
    let oldImagePath: string | undefined;

    if (productData.image) {
        imageInfo = await uploadImage(productData.image, productData.name);
    } else {
         if (wasComplexProduct) {
            oldImagePath = baseProductSnap.data()?.imagePath;
         } else {
            const oldMenuItemSnap = await getDoc(doc(db, 'menuItems', productId));
            oldImagePath = oldMenuItemSnap.data()?.imagePath;
         }
    }
    
    // Clean up old items no longer needed
    if (wasComplexProduct) {
        const submittedVariantIds = new Set(productData.variants.map(v => v.id));
        const existingVariantsSnapshot = await getDocs(query(collection(db, 'menuItems'), where('baseProductId', '==', productId)));
        existingVariantsSnapshot.docs.forEach(doc => {
            if (!submittedVariantIds.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });
    }

    if (isUpdatingToSimple) {
        if (wasComplexProduct) {
            batch.delete(baseProductRef);
        }

        const variant = productData.variants[0];
        const menuItemRef = doc(db, 'menuItems', productId); 
        
        const updateData: any = {
            name: productData.name,
            category: productData.category,
            price: variant.price,
            inventoryConsumption: variant.inventoryConsumption || [],
            isPreOrder: variant.isPreOrder ?? false,
            baseProductId: null,
            variantName: null,
            configurableOptions: variant.configurableOptions || null,
            availableInStoreIds: productData.availableInStoreIds || [],
        };
        
        if (imageInfo?.imagePath) {
            updateData.imagePath = imageInfo.imagePath;
        } else if (oldImagePath) {
            updateData.imagePath = oldImagePath;
        }

        batch.set(menuItemRef, updateData, { merge: true });
        await batch.commit();
        
        const docSnap = await getDoc(menuItemRef);
        const currentData = docSnap.data();
        
        return {
            id: productId,
            name: productData.name,
            category: productData.category,
            variants: [{...variant, id: productId}],
            imageUrl: imageInfo?.imageUrl || (currentData?.imagePath ? await getDownloadURL(ref(storage, currentData.imagePath)) : 'https://placehold.co/300x200.png'),
            imagePath: imageInfo?.imagePath || currentData?.imagePath,
            aiHint: currentData?.aiHint,
            availableInStoreIds: currentData?.availableInStoreIds,
            blurDataURL: PLAUSIBLE_BLUR_DATA_URL,
        };

    } else {
        if (!wasComplexProduct) {
            const oldMenuItemRef = doc(db, 'menuItems', productId);
            const oldMenuItemSnap = await getDoc(oldMenuItemRef);
            if(oldMenuItemSnap.exists()) {
                // To prevent race conditions, do not delete the old item but rather update it and make it the first variant
            } else {
                 //This should not happen if the UI is correct
                console.error("Trying to convert a non-existent simple product to complex");
            }
        }
        
        const bpUpdateData: any = {
            name: productData.name,
            category: productData.category,
            availableInStoreIds: productData.availableInStoreIds || [],
        };

        if (imageInfo?.imagePath) {
            bpUpdateData.imagePath = imageInfo.imagePath;
        } else if (oldImagePath) {
            bpUpdateData.imagePath = oldImagePath;
        }

        batch.set(baseProductRef, bpUpdateData, { merge: true });

        const finalVariants: ProductVariant[] = [];
        for (const variant of productData.variants) {
            const isNew = variant.id.startsWith('new_');
            const variantRef = isNew ? doc(collection(db, 'menuItems')) : doc(db, 'menuItems', variant.id);
            
            const menuItemData: any = {
                baseProductId: productId,
                variantName: variant.name,
                price: variant.price,
                inventoryConsumption: variant.inventoryConsumption || [],
                isPreOrder: variant.isPreOrder ?? false,
                name: `${productData.name} - ${variant.name}`,
                category: productData.category,
                configurableOptions: variant.configurableOptions || null,
            };

            batch.set(variantRef, menuItemData, { merge: true });
            finalVariants.push({ ...variant, id: variantRef.id });
        }

        if(!wasComplexProduct) {
            const simpleProductRef = doc(db, 'menuItems', productId);
            const simpleProductSnap = await getDoc(simpleProductRef);
            const firstVariantIsOldProduct = productData.variants[0]?.id === productId;
            if (simpleProductSnap.exists() && !firstVariantIsOldProduct) {
                batch.delete(simpleProductRef);
            }
        }
        
        await batch.commit();

        const docSnap = await getDoc(baseProductRef);
        const currentData = docSnap.data();

        return {
            id: productId,
            name: productData.name,
            category: productData.category,
            variants: finalVariants,
            imageUrl: imageInfo?.imageUrl || (currentData?.imagePath ? await getDownloadURL(ref(storage, currentData.imagePath)) : 'https://placehold.co/300x200.png'),
            imagePath: imageInfo?.imagePath || currentData?.imagePath,
            aiHint: currentData?.aiHint,
            availableInStoreIds: currentData?.availableInStoreIds,
            blurDataURL: PLAUSIBLE_BLUR_DATA_URL,
        };
    }
}

export async function deleteProduct(productId: string): Promise<void> {
    const batch = writeBatch(db);
    
    const baseProductRef = doc(db, 'baseProducts', productId);
    const baseProductSnap = await getDoc(baseProductRef);

    if (baseProductSnap.exists()) {
        const imagePath = baseProductSnap.data()?.imagePath;
        if (imagePath) {
            await deleteObject(ref(storage, imagePath)).catch(console.error);
        }
        batch.delete(baseProductRef);
        const q = query(collection(db, 'menuItems'), where('baseProductId', '==', productId));
        const variantsSnapshot = await getDocs(q);
        variantsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
    } else {
        const menuItemRef = doc(db, 'menuItems', productId);
        const menuItemSnap = await getDoc(menuItemRef);
        if (menuItemSnap.exists()) {
            const imagePath = menuItemSnap.data()?.imagePath;
            if (imagePath) {
                await deleteObject(ref(storage, imagePath)).catch(console.error);
            }
            batch.delete(menuItemRef);
        }
    }

    await batch.commit();
}


export async function bulkAssignProductsToStore(storeId: string): Promise<void> {
    const batch = writeBatch(db);

    // Get all base products
    const baseProductsRef = collection(db, 'baseProducts');
    const baseProductsSnap = await getDocs(baseProductsRef);
    baseProductsSnap.forEach(doc => {
        batch.update(doc.ref, {
            availableInStoreIds: arrayUnion(storeId)
        });
    });

    // Get all simple products (menuItems without a baseProductId)
    const menuItemsRef = collection(db, 'menuItems');
    const simpleProductsQuery = query(menuItemsRef, where('baseProductId', '==', null));
    const simpleProductsSnap = await getDocs(simpleProductsQuery);
    simpleProductsSnap.forEach(doc => {
        batch.update(doc.ref, {
            availableInStoreIds: arrayUnion(storeId)
        });
    });

    await batch.commit();
}
