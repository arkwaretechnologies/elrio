
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, SubmitHandler, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { X, PlusCircle, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Search } from 'lucide-react';
import type { BaseProduct, Category, InventoryItem, MenuItem, Store, UnitOfMeasurement } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea } from './ui/scroll-area';
import { MultiSelect } from './multi-select';
import { Separator } from './ui/separator';
import { optimizeImage } from '@/lib/utils';

const inventoryConsumptionSchema = z.object({
  inventoryItemId: z.string().min(1, "Item must be selected"),
  quantity: z.coerce.number().min(0.01, 'Must be greater than 0'),
});

const configurableOptionsSchema = z.object({
    selectionLimit: z.coerce.number().int().min(1, 'Must be at least 1'),
    allowedProductIds: z.array(z.string()).min(1, 'Select at least one allowed product'),
});

const variantSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Variant name is required'),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
  productType: z.enum(['standard', 'assorted', 'non-inventoried', 'custom']),
  inventoryConsumption: z.array(inventoryConsumptionSchema).optional(),
  configurableOptions: configurableOptionsSchema.optional(),
});

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  hasMultipleVariants: z.boolean(),
  image: z.any()
    .optional()
    .refine(
      (files) => !files || files?.length === 0 || ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(files?.[0]?.type),
      ".jpg, .jpeg, .png and .webp files are accepted."
    ),
  variants: z.array(variantSchema).min(1, 'At least one variant is required'),
  availableInStoreIds: z.array(z.string()).optional(),
}).refine(data => {
    const validateVariant = (variant: ProductFormValues['variants'][0]) => {
        if (variant.productType === 'standard' && (!variant.inventoryConsumption || variant.inventoryConsumption.length === 0)) return false;
        if (variant.productType === 'assorted' && !variant.configurableOptions) return false;
        // Price must be > 0 unless it's a 'custom' type
        if (variant.productType !== 'custom' && variant.price <= 0) return false;
        return true;
    }
    if (data.hasMultipleVariants) {
        return data.variants.every(validateVariant);
    }
    if (data.variants.length > 0) {
        return validateVariant(data.variants[0]);
    }
    return true;
}, {
    message: "Each variant must be correctly configured. Standard items need inventory, Assorted items need options, and all non-custom items must have a price greater than 0.",
    path: ["variants"],
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  product?: BaseProduct | null;
  categories: Category[];
  inventoryItems: InventoryItem[];
  allMenuItems: MenuItem[];
  allStores: Store[];
  onSave: (data: any, productId?: string) => void;
  onCancel: () => void;
}

const getProductType = (variant: any): 'standard' | 'assorted' | 'non-inventoried' | 'custom' => {
    if (variant.isCustomPrice) return 'custom';
    if (variant.configurableOptions) return 'assorted';
    if (!variant.inventoryConsumption || variant.inventoryConsumption.length === 0) return 'non-inventoried';
    return 'standard';
};

const getDefaultVariants = (product?: BaseProduct | null) => {
    if (!product?.variants?.length) {
        return [{
            id: `new_${uuidv4()}`,
            name: 'Default',
            price: 0,
            productType: 'standard' as const,
            inventoryConsumption: [],
            configurableOptions: undefined,
        }];
    }
    return product.variants.map(v => ({
        id: v.id || `new_${uuidv4()}`,
        name: v.name,
        price: v.price,
        productType: getProductType(v),
        inventoryConsumption: (v.inventoryConsumption || []).map((c) => ({
          inventoryItemId: c.inventoryItemId,
          quantity: c.quantity,
        })),
        configurableOptions: v.configurableOptions || undefined,
        isCustomPrice: v.isCustomPrice,
    }));
}


export function ProductForm({ product, categories, inventoryItems, allMenuItems, allStores, onSave, onCancel }: ProductFormProps) {
  
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      categoryId: categories.find(c => c.name === product?.category)?.id ?? '',
      image: undefined,
      hasMultipleVariants: product ? product.variants.some(v => v.id !== product.id) || product.variants.length > 1 : false,
      variants: getDefaultVariants(product),
      availableInStoreIds: product?.availableInStoreIds ?? allStores.map(s => s.id),
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "variants",
  });
  
  useEffect(() => {
    if (product && categories.length > 0) {
      const category = categories.find(c => c.name === product.category);
      form.reset({
        name: product.name,
        categoryId: category?.id ?? '',
        image: undefined,
        hasMultipleVariants: product.variants.some(v => v.id !== product.id) || product.variants.length > 1,
        variants: getDefaultVariants(product),
        availableInStoreIds: product.availableInStoreIds ?? allStores.map(s => s.id),
      });
    } else if (!product) {
        form.reset({
            name: '',
            categoryId: '',
            image: undefined,
            hasMultipleVariants: false,
            variants: getDefaultVariants(null),
            availableInStoreIds: allStores.map(s => s.id),
        });
    }
  }, [product, categories, allStores, form]);


  const hasMultipleVariants = form.watch('hasMultipleVariants');
  
  React.useEffect(() => {
    const variants = form.getValues('variants');
    if (!hasMultipleVariants && variants.length > 1) {
        const firstVariant = variants[0];
        firstVariant.name = 'Default';
        replace([firstVariant]);
    }
    if (hasMultipleVariants && variants.length === 0) {
        addVariant();
    }
  }, [hasMultipleVariants, form]);


  const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
    let optimizedImageFile;
    if (data.image && data.image[0]) {
      optimizedImageFile = await optimizeImage(data.image[0]);
    }

    const submissionData = {
      ...data,
      image: optimizedImageFile ? [optimizedImageFile] : undefined,
      variants: data.variants.map(v => {
        const variantData: any = {
          id: v.id,
          name: data.hasMultipleVariants ? v.name : 'Default',
          price: v.price,
          isCustomPrice: false,
          isPreOrder: false, // pre-order type is removed for now
          inventoryConsumption: [],
          configurableOptions: undefined,
        };

        switch (v.productType) {
          case 'standard':
            variantData.inventoryConsumption = (v.inventoryConsumption || []).map((line) => ({
              inventoryItemId: line.inventoryItemId,
              quantity: line.quantity,
            }));
            break;
          case 'assorted':
            variantData.configurableOptions = v.configurableOptions;
            break;
          case 'custom':
            variantData.isCustomPrice = true;
            variantData.price = 0;
            break;
          case 'non-inventoried':
            // No specific properties, inherits defaults
            break;
        }
        
        return variantData;
      })
    };
    onSave(submissionData, product?.id);
  };
  
  const addVariant = () => {
    append({
        id: `new_${uuidv4()}`,
        name: '',
        price: 0,
        productType: 'standard',
        inventoryConsumption: [],
        configurableOptions: undefined,
    });
  }

  const imageRef = form.register("image");

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Chiffon Cake 9x13" {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <FormField
            control={form.control}
            name="image"
            render={() => (
              <FormItem>
                <FormLabel>Product Image</FormLabel>
                 <FormDescription>
                  { product ? "Leave blank to keep the current image." : "Upload an image for this product."}
                </FormDescription>
                <FormControl>
                  <Input 
                    type="file" 
                    accept="image/*"
                    {...imageRef}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        <Separator />
        
        <FormField
            control={form.control}
            name="availableInStoreIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Store Availability</FormLabel>
                <FormDescription>Select which stores this product will be available in. If none are selected, it won't appear in any POS.</FormDescription>
                <MultiSelect
                    options={allStores.map(s => ({ value: s.id, label: s.name }))}
                    selected={field.value ?? []}
                    onChange={field.onChange}
                    className="w-full"
                />
                <FormMessage />
              </FormItem>
            )}
          />

        <Card>
            <CardHeader>
                <CardTitle>Variants</CardTitle>
                 <FormField
                    control={form.control}
                    name="hasMultipleVariants"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                             <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>This product has multiple variants</FormLabel>
                                <FormDescription>
                                    Enable for products with different flavors, sizes, etc.
                                </FormDescription>
                            </div>
                        </FormItem>
                    )}
                />
            </CardHeader>
            <CardContent className="space-y-4">
                {fields.map((field, index) => (
                    <VariantForm
                        key={field.id}
                        nestIndex={index}
                        inventoryItems={inventoryItems}
                        allMenuItems={allMenuItems}
                        showVariantName={hasMultipleVariants}
                        onRemove={() => remove(index)}
                        canRemove={hasMultipleVariants && fields.length > 1}
                    />
                ))}
                 {hasMultipleVariants && (
                     <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Variant
                    </Button>
                 )}
                 <FormMessage>{form.formState.errors.variants?.message || form.formState.errors.variants?.root?.message}</FormMessage>
            </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Product'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}


function VariantForm({ nestIndex, inventoryItems, allMenuItems, showVariantName, onRemove, canRemove }: { nestIndex: number, inventoryItems: InventoryItem[], allMenuItems: MenuItem[], showVariantName: boolean, onRemove: () => void, canRemove: boolean }) {
    const { control, watch, setValue, getValues } = useFormContext();
    const productType = watch(`variants.${nestIndex}.productType`);
    
    useEffect(() => {
        const currentConfig = getValues(`variants.${nestIndex}.configurableOptions`);
        if (productType === 'assorted' && !currentConfig) {
             setValue(`variants.${nestIndex}.configurableOptions`, {
                selectionLimit: 0,
                allowedProductIds: []
            }, { shouldValidate: true });
        }
        if (productType === 'custom') {
            setValue(`variants.${nestIndex}.price`, 0);
        }
    }, [productType, nestIndex, setValue, getValues]);


    return (
        <div className="p-4 border rounded-lg space-y-4 relative">
             {canRemove && (
                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={onRemove}>
                    <X className="h-4 w-4" />
                </Button>
            )}
            <div className={`grid grid-cols-1 ${showVariantName ? 'sm:grid-cols-2' : ''} gap-4`}>
                {showVariantName && (
                     <FormField
                        control={control}
                        name={`variants.${nestIndex}.name`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Variant Name</FormLabel>
                            <FormControl><Input placeholder="e.g., Ube, Mocha" {...field} autoComplete="off" /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}
                <FormField
                    control={control}
                    name={`variants.${nestIndex}.price`}
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                            <Input 
                                type="number" 
                                step="0.01" 
                                {...field} 
                                autoComplete="off" 
                                value={isNaN(field.value) ? '' : field.value ?? ''} 
                                disabled={productType === 'custom'}
                            />
                        </FormControl>
                         {productType === 'custom' && <FormDescription>Price will be set at the point of sale.</FormDescription>}
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            
            <FormField
                control={control}
                name={`variants.${nestIndex}.productType`}
                render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Product Type</FormLabel>
                        <FormControl>
                            <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2"
                            >
                                <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                                    <FormControl><RadioGroupItem value="standard" /></FormControl>
                                    <FormLabel className="font-normal cursor-pointer flex-1">Standard</FormLabel>
                                </FormItem>
                                 <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                                    <FormControl><RadioGroupItem value="assorted" /></FormControl>
                                    <FormLabel className="font-normal cursor-pointer flex-1">Assorted Box</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                                    <FormControl><RadioGroupItem value="non-inventoried" /></FormControl>
                                    <FormLabel className="font-normal cursor-pointer flex-1">Non-Inventoried</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:border-primary">
                                    <FormControl><RadioGroupItem value="custom" /></FormControl>
                                    <FormLabel className="font-normal cursor-pointer flex-1">Custom Price</FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {productType === 'standard' && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                     <FormDescription>
                        Deduct from inventory stock when this item is sold.
                    </FormDescription>
                    <InventoryConsumptionForm nestIndex={nestIndex} inventoryItems={inventoryItems} />
                </div>
            )}

             {productType === 'assorted' && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <FormDescription>
                        Allows customers to choose items at the point of sale.
                    </FormDescription>
                    <ConfigurableProductForm nestIndex={nestIndex} allMenuItems={allMenuItems} />
                </div>
            )}
            
            {(productType === 'non-inventoried' || productType === 'custom') && (
                 <div className="p-4 border rounded-lg bg-muted/30">
                    <FormDescription>
                        This item does not use inventory stock.
                    </FormDescription>
                </div>
            )}
            
        </div>
    )
}


function InventoryConsumptionForm({ nestIndex, inventoryItems }: { nestIndex: number, inventoryItems: InventoryItem[]}) {
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `variants.${nestIndex}.inventoryConsumption`,
  });
  
  const inventoryItemMap = useMemo(() => new Map(inventoryItems.map(item => [item.id, item])), [inventoryItems]);

  return (
    <div className='space-y-4'>
        {fields.map((item, k) => {
            const selectedItemId = watch(`variants.${nestIndex}.inventoryConsumption.${k}.inventoryItemId`);
            const selectedItem = inventoryItemMap.get(selectedItemId);
            const isDecimal = selectedItem?.unit !== 'pcs' && selectedItem?.unit !== 'cups';

            return (
              <div key={item.id} className="space-y-2 p-2 border rounded-md bg-background">
                  <div className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                  <FormField
                      control={control}
                      name={`variants.${nestIndex}.inventoryConsumption.${k}.inventoryItemId`}
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel className="text-xs">Inventory Item</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select base item" /></SelectTrigger></FormControl>
                              <SelectContent position="popper">
                                  {inventoryItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={control}
                      name={`variants.${nestIndex}.inventoryConsumption.${k}.quantity`}
                      defaultValue={1}
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel className="text-xs">Qty Consumed ({selectedItem?.unit || '...'})</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step={isDecimal ? "0.01" : "1"}
                              {...field}
                              autoComplete="off"
                            />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => remove(k)}>
                      <X className="h-4 w-4" />
                  </Button>
                  </div>
              </div>
            )
        })}

        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ inventoryItemId: '', quantity: 1 })}
        >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Item
        </Button>
        <FormDescription>
          Whether a recipe line deducts stock is controlled per ingredient in Inventory Item Master (Track store stock).
        </FormDescription>
        <FormMessage>
           {/* @ts-ignore */}
           {useFormContext().formState.errors?.variants?.[nestIndex]?.inventoryConsumption?.message}
        </FormMessage>
    </div>
  )
}


function DualListBox({ items, selected, onSelect, onDeselect, onSelectAll, onDeselectAll, renderItem }: any) {
    const [searchAvailable, setSearchAvailable] = useState('');
    const [searchSelected, setSearchSelected] = useState('');

    const filteredAvailable = items.filter((item: any) => 
        !selected.includes(item.id) &&
        item.name.toLowerCase().includes(searchAvailable.toLowerCase())
    );

    const filteredSelected = items.filter((item: any) => 
        selected.includes(item.id) &&
        item.name.toLowerCase().includes(searchSelected.toLowerCase())
    );
    
    return (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            {/* Available List */}
            <div className="border rounded-lg p-2 flex flex-col h-80">
                <p className="font-semibold text-sm mb-2 px-1">Available</p>
                <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-8 h-9" value={searchAvailable} onChange={e => setSearchAvailable(e.target.value)} />
                </div>
                <ScrollArea className="flex-grow">
                    <div className="space-y-1 pr-2">
                        {filteredAvailable.map((item: any) => (
                            <div key={item.id} onClick={() => onSelect(item.id)} className="cursor-pointer">
                                {renderItem(item)}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => onSelectAll(filteredAvailable.map((i: any) => i.id))}><ChevronsRight className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" size="icon" onClick={() => onSelect(null)} disabled><ChevronRight className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" size="icon" onClick={() => onDeselect(null)} disabled><ChevronLeft className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" size="icon" onClick={onDeselectAll}><ChevronsLeft className="h-4 w-4" /></Button>
            </div>
            
            {/* Selected List */}
             <div className="border rounded-lg p-2 flex flex-col h-80">
                <p className="font-semibold text-sm mb-2 px-1">Selected</p>
                 <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-8 h-9" value={searchSelected} onChange={e => setSearchSelected(e.target.value)} />
                </div>
                <ScrollArea className="flex-grow">
                    <div className="space-y-1 pr-2">
                        {filteredSelected.map((item: any) => (
                           <div key={item.id} onClick={() => onDeselect(item.id)} className="cursor-pointer">
                                {renderItem(item)}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}

function ConfigurableProductForm({ nestIndex, allMenuItems }: { nestIndex: number, allMenuItems: any[] }) {
    const { control, setValue, watch } = useFormContext();
    const fieldName = `variants.${nestIndex}.configurableOptions.allowedProductIds`;
    const allowedProductIds = watch(fieldName) || [];
    
    const availableItems = allMenuItems.filter(item => !item.isPreOrder && !item.configurableOptions);
    
    const handleSelect = (itemId: string) => {
        setValue(fieldName, [...allowedProductIds, itemId]);
    };

    const handleDeselect = (itemId: string) => {
        setValue(fieldName, allowedProductIds.filter((id: string) => id !== itemId));
    };
    
    const handleSelectAll = (itemIds: string[]) => {
        setValue(fieldName, [...new Set([...allowedProductIds, ...itemIds])]);
    };
    
    const handleDeselectAll = () => {
         setValue(fieldName, []);
    }

    return (
        <div className="space-y-4">
             <FormField
                control={control}
                name={`variants.${nestIndex}.configurableOptions.selectionLimit`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Selection Limit</FormLabel>
                    <FormControl>
                        <Input 
                            type="number" 
                            placeholder="e.g., 15"
                            {...field}
                            value={field.value ?? ''}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
                control={control}
                name={fieldName}
                render={() => (
                <FormItem>
                    <FormLabel>Allowed Products</FormLabel>
                    <FormDescription>Select which products can be chosen for this box.</FormDescription>
                    <FormControl>
                       <DualListBox
                            items={availableItems}
                            selected={allowedProductIds}
                            onSelect={handleSelect}
                            onDeselect={handleDeselect}
                            onSelectAll={handleSelectAll}
                            onDeselectAll={handleDeselectAll}
                            renderItem={(item: any) => (
                                <div className="p-2 border rounded-md hover:bg-muted text-sm">
                                    {item.name}
                                </div>
                            )}
                       />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
    )
}

    