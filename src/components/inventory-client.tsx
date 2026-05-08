"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Shapes } from 'lucide-react';
import Link from 'next/link';

function StatCard({ icon: Icon, title, value, color, href }: { icon: React.ElementType, title: string, value: string | number, color: string, href?: string }) {
  const cardContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}

export function InventoryClient() {

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Select an area to manage</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Package} title="Products" value="Manage" color="text-blue-500" href="/inventory/products" />
        <StatCard icon={Shapes} title="Categories" value="Manage" color="text-purple-500" href="/inventory/categories" />
      </div>
    </div>
  );
}
