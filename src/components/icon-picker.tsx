"use client";

import React, { useState, useMemo } from 'react';
import { icons, type LucideProps } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icon } from './icon';

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

const iconNames = Object.keys(icons);

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = useMemo(() => {
    return iconNames.filter(name => name.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Icon name={value as any} className="mr-2 h-4 w-4" />
          <span>{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="p-2">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
            autoComplete='off'
          />
        </div>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-6 gap-1 p-2">
            {filteredIcons.map(iconName => (
              <Button
                key={iconName}
                variant={value === iconName ? 'default' : 'ghost'}
                size="icon"
                onClick={() => {
                  onChange(iconName);
                  setIsOpen(false);
                }}
                className="h-10 w-10"
              >
                <Icon name={iconName as any} className="h-5 w-5" />
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
