
"use client";

import React, { useMemo, useState, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, EventProps, ToolbarProps, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isSameDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { Sale } from '@/lib/types';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PreOrderDetailsDialog } from './pre-order-details-dialog';

// Setup the localizer by providing the formatters and timezone we want to use.
const locales = {
  'en-US': enUS,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: locales['en-US'] }),
  getDay,
  locales,
});

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Sale;
}

const CustomEvent = ({ event }: EventProps<CalendarEvent>) => {
  const balance = event.resource.total - (event.resource.amountPaid || 0);
  const isPaid = event.resource.isPaidInFull || balance <= 0;

  return (
    <div className={`text-xs p-1 rounded-sm ${isPaid ? 'bg-green-100/50 text-green-800' : 'bg-red-100/50 text-red-800'}`}>
      <div className="font-semibold truncate">{event.resource.customerName || 'Walk-in'}</div>
      <div>{isPaid ? 'Paid' : `Balance: ₱${balance.toFixed(2)}`}</div>
    </div>
  );
};

const CustomToolbar = ({ label, onNavigate }: ToolbarProps) => {
  return (
    <div className="rbc-toolbar">
      <span className="rbc-btn-group">
        <Button type="button" onClick={() => onNavigate('TODAY')}>Today</Button>
        <Button type="button" onClick={() => onNavigate('PREV')}><ChevronLeft className="h-4 w-4" /></Button>
        <Button type="button" onClick={() => onNavigate('NEXT')}><ChevronRight className="h-4 w-4" /></Button>
      </span>
      <span className="rbc-toolbar-label">{label}</span>
      <span className="rbc-btn-group">
        {/* View buttons can go here if needed, e.g., Month, Week, Day */}
      </span>
    </div>
  );
};


export function PreOrdersClient({ initialPreOrders }: { initialPreOrders: Sale[] }) {
  const [date, setDate] = useState(new Date());
  const [preOrders, setPreOrders] = useState<Sale[]>(initialPreOrders);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const events = useMemo(() => {
    return preOrders.map(sale => ({
      title: `${sale.customerName || 'Walk-in'} - ₱${sale.total.toFixed(2)}`,
      start: new Date(sale.pickupDate || sale.timestamp),
      end: new Date(sale.pickupDate || sale.timestamp),
      resource: sale,
    }));
  }, [preOrders]);

  const selectedDayOrders = useMemo(() => {
    if (!selectedDay) return [];
    return preOrders.filter(sale => isSameDay(new Date(sale.pickupDate || sale.timestamp), selectedDay));
  }, [selectedDay, preOrders]);

  const handleNavigate = useCallback((newDate: Date) => setDate(newDate), [setDate]);

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    setSelectedDay(slotInfo.start);
    setIsModalOpen(true);
  };
  
  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedDay(event.start);
    setIsModalOpen(true);
  };
  
  const handleOrderUpdate = (updatedOrder: Sale) => {
    setPreOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };
  
  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pre-orders Report</h1>
          <p className="text-muted-foreground">Monthly calendar view of all pre-ordered items.</p>
        </div>

        <div className="h-[80vh]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            date={date}
            onNavigate={handleNavigate}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            components={{
              event: CustomEvent,
              toolbar: CustomToolbar,
            }}
            views={['month']}
          />
        </div>
      </div>
      
      {selectedDay && (
        <PreOrderDetailsDialog
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          date={selectedDay}
          orders={selectedDayOrders}
          onOrderUpdated={handleOrderUpdate}
        />
      )}
    </>
  );
}
