
"use client";

import React, { useState, useEffect } from 'react';
import type { Store, Sale, EodReport } from '@/lib/types';
import { getStores } from '@/services/store-service';
import { getSalesForToday } from '@/services/sales-service';
import { getEodReport } from '@/services/eod-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store as StoreIcon, MapPin, Building2, LayoutGrid, CheckCircle, Clock } from 'lucide-react';
import { CakeLoader } from '@/components/cake-loader';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface StoreWithDetails extends Store {
    salesToday: number;
    eodRanToday: boolean;
}

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


export default function SuperAdminDashboardPage() {
    const [storesWithDetails, setStoresWithDetails] = useState<StoreWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStoresAndSales = async () => {
            try {
                const fetchedStores = await getStores();
                const storesWithDetailsData = await Promise.all(
                    fetchedStores.map(async (store) => {
                        const [sales, eodReport] = await Promise.all([
                            getSalesForToday(store.id),
                            getEodReport(store.id, new Date())
                        ]);
                        // Exclude "On Credit" and "VOIDED" sales from the dashboard total
                        const totalSales = sales
                          .filter(sale => sale.paymentMethod !== 'On Credit' && sale.status !== 'VOIDED')
                          .reduce((sum, sale) => sum + sale.total, 0);

                        return { ...store, salesToday: totalSales, eodRanToday: !!eodReport };
                    })
                );
                setStoresWithDetails(storesWithDetailsData);
            } catch (err) {
                console.error("Failed to fetch stores and sales", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStoresAndSales();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <CakeLoader />
                <p className="mt-4 text-lg text-muted-foreground">Loading stores and sales data...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
                    <p className="text-muted-foreground">High-level overview of all business operations.</p>
                </div>
            </div>

             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard icon={Building2} title="Total Stores" value={storesWithDetails.length} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Stores</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {storesWithDetails.map(store => (
                        <Card key={store.id} className="p-4 flex flex-col gap-4">
                           <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <StoreIcon className="h-8 w-8 text-primary" />
                                    <div>
                                        <p className="font-semibold">{store.name}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> {store.location || 'No location set'}
                                        </p>
                                    </div>
                               </div>
                               <Badge variant={store.eodRanToday ? 'default' : 'secondary'} className={store.eodRanToday ? 'bg-green-100 text-green-800' : ''}>
                                 {store.eodRanToday ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                                 {store.eodRanToday ? 'EOD Ran' : 'Open'}
                               </Badge>
                           </div>
                           <div className="border-t pt-3">
                                <p className="text-xs text-muted-foreground">Sales Today</p>
                                <p className="text-lg font-bold flex items-center gap-1">
                                    PHP {store.salesToday.toFixed(2)}
                                </p>
                           </div>
                        </Card>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
