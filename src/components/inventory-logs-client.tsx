

"use client";

import React, { useState, useMemo } from 'react';
import type { InventoryLog, InventoryItem, InventoryAdjustmentType, UnitOfMeasurement } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { inventoryAdjustmentTypes } from '@/lib/types';

export function InventoryLogsClient({ initialLogs, inventoryItems }: { initialLogs: InventoryLog[], inventoryItems: InventoryItem[] }) {
  const [logs, setLogs] = useState<InventoryLog[]>(initialLogs);
  const [filterItemId, setFilterItemId] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const itemMatch = filterItemId === 'all' || log.inventoryItemId === filterItemId;
      const typeMatch = filterType === 'all' || log.type === filterType;
      return itemMatch && typeMatch;
    });
  }, [logs, filterItemId, filterType]);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Inventory Logs</h1>
          <p className="text-muted-foreground">A history of all stock adjustments.</p>
        </div>
        <div className="flex gap-2">
            <div className="w-56">
                <Select onValueChange={setFilterType} defaultValue="all">
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by type..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {inventoryAdjustmentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                            {type}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-56">
                <Select onValueChange={setFilterItemId} defaultValue="all">
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by item..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Items</SelectItem>
                        {inventoryItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                            {item.name}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
      </div>
       <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No logs found for the selected filter(s).
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.timestamp), "MMM d, yyyy, h:mm a")}
                      </TableCell>
                      <TableCell>{log.inventoryItemName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center font-bold ${log.adjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {log.adjustment > 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
                          {log.adjustment} {log.unit}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{log.notes || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
