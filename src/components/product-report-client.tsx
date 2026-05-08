
"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Package, GitCommitHorizontal, FileDown } from 'lucide-react';
import type { BaseProduct, StoreInventory, ProductVariant } from '@/lib/types';
import { consumptionDeductsStock } from '@/lib/types';
import { format } from 'date-fns';
import { useAuth } from '@/context/auth-context';


function StatCard({ icon: Icon, title, value }: { icon: React.ElementType, title: string, value: string | number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function ProductReportClient({ initialProducts }: { initialProducts: BaseProduct[], inventoryItems: StoreInventory[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const { inventory } = useAuth();
  const inventoryItemMap = useMemo(() => new Map(inventory.map(item => [item.inventoryItemId, item])), [inventory]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return initialProducts;
    return initialProducts.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.variants.some(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, initialProducts]);

  const stats = useMemo(() => {
    const totalProducts = initialProducts.length;
    const totalVariants = initialProducts.reduce((sum, p) => sum + p.variants.length, 0);
    
    return {
      totalProducts,
      totalVariants,
    };
  }, [initialProducts]);
  
  const getAvailableUnits = (variant: ProductVariant) => {
    if (variant.isPreOrder) return Infinity;
    if (variant.configurableOptions) return Infinity; // Assorted products don't have a direct stock count
    if (!variant.inventoryConsumption || variant.inventoryConsumption.length === 0) return 0;
    
    const deducting = variant.inventoryConsumption.filter((c) =>
      consumptionDeductsStock(c, inventoryItemMap.get(c.inventoryItemId)),
    );
    if (deducting.length === 0) return Infinity;

    const possibleUnits = deducting.map(c => {
      const item = inventoryItemMap.get(c.inventoryItemId);
      if (!item) return 0;
      return Math.floor(item.stock / c.quantity);
    });

    return Math.min(...possibleUnits);
  };
  
  const getStockStatus = (variant: ProductVariant) => {
    if (variant.isPreOrder) return { status: "Pre-order", unit: '' };
    if (variant.configurableOptions) return { status: "Assorted", unit: '' };

    const units = getAvailableUnits(variant);

    // Prefer a stock-deduction line for unit display when mixed with track-only rows.
    const primaryConsumption =
      variant.inventoryConsumption?.find((c) =>
        consumptionDeductsStock(c, inventoryItemMap.get(c.inventoryItemId)),
      ) ?? variant.inventoryConsumption?.[0];
    const primaryItem = primaryConsumption ? inventoryItemMap.get(primaryConsumption.inventoryItemId) : null;
    const unit = primaryItem?.unit || 'pcs';
    
    const status = units > 0 ? `${units}` : 'Out of Stock';
    return { status, unit };
  };
  
  const handleExport = () => {
    const dataToExport = filteredProducts.flatMap(product => 
      product.variants.map(variant => {
        const { status, unit } = getStockStatus(variant);
        
        return {
          'Product Name': product.name,
          'Variant Name': variant.name,
          'Category': product.category,
          'Price': variant.price,
          'Stock Status': status,
          'Unit': unit,
        };
      })
    );

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, `ElRio_Product_List_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Product List Report</h1>
        <p className="text-muted-foreground">A complete list of all products and their variants.</p>
      </div>
      
       <div className="grid gap-4 md:grid-cols-2">
        <StatCard icon={Package} title="Total Base Products" value={stats.totalProducts} />
        <StatCard icon={GitCommitHorizontal} title="Total Variants" value={stats.totalVariants} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products or variants..."
                className="pl-8"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button onClick={handleExport}>
              <FileDown className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Product / Variant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(product => (
                <React.Fragment key={product.id}>
                  <TableRow className="bg-muted/50 hover:bg-muted/60">
                    <TableCell>
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="rounded-md object-cover"
                      />
                    </TableCell>
                    <TableCell colSpan={4} className="font-bold text-lg">{product.name}</TableCell>
                  </TableRow>
                  {product.variants.map(variant => {
                     const { status, unit } = getStockStatus(variant);
                    return (
                        <TableRow key={variant.id} className="hover:bg-accent/50">
                            <TableCell></TableCell>
                            <TableCell className="pl-8">{variant.name}</TableCell>
                            <TableCell><Badge variant="outline">{product.category}</Badge></TableCell>
                            <TableCell>₱{variant.price.toFixed(2)}</TableCell>
                            <TableCell>
                                <Badge 
                                    variant={status === 'Out of Stock' ? 'destructive' : 'secondary'}
                                    className={status === 'Pre-order' ? 'bg-purple-100 text-purple-800' : status === 'Assorted' ? 'bg-blue-100 text-blue-800' : ''}
                                >
                                    {status} {unit}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    )
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
