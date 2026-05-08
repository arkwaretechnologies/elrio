"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export function CakeLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn("cake-loader", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="cake-loader__cherry" aria-hidden />
      <span className="cake-loader__tier cake-loader__tier--sm" aria-hidden />
      <span className="cake-loader__tier cake-loader__tier--md" aria-hidden />
      <span className="cake-loader__tier cake-loader__tier--lg" aria-hidden />
    </div>
  );
}
