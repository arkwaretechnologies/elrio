"use client";

import { usePwaInstall } from '@/hooks/use-pwa-install';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';

type PwaInstallButtonProps = {
  variant?: 'icon' | 'menu-item';
};

const INSTALL_UNAVAILABLE_TITLE =
  'Your browser has not offered an install prompt yet. Try Chrome or Edge, use the address bar Install icon, or use “Add to Home Screen” / “Install app” from the browser menu.';

export function PwaInstallButton({ variant = 'icon' }: PwaInstallButtonProps) {
  const { canInstall, install, isStandalone } = usePwaInstall();

  if (variant === 'menu-item') {
    if (isStandalone) {
      return (
        <DropdownMenuItem disabled className="opacity-60">
          <Download className="mr-2 h-4 w-4" />
          <span>App already installed</span>
        </DropdownMenuItem>
      );
    }

    return (
      <DropdownMenuItem
        disabled={!canInstall}
        title={!canInstall ? INSTALL_UNAVAILABLE_TITLE : undefined}
        className={canInstall ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
        onSelect={() => {
          if (canInstall) void install();
        }}
      >
        <Download className="mr-2 h-4 w-4" />
        <span>Install app</span>
      </DropdownMenuItem>
    );
  }

  if (!canInstall) {
    return null;
  }

  return (
    <Button 
        variant="ghost" 
        size="icon" 
        className="text-muted-foreground" 
        onClick={() => void install()}
        aria-label="Install App"
    >
      <Download className="h-5 w-5" />
    </Button>
  );
}
