
"use client"

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarMobileHeader,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import {
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
  Store,
  LayoutGrid,
  Package,
  Archive,
  Shapes,
  User as UserIcon,
  DatabaseZap,
  BarChart3,
  Receipt,
  BookMarked,
  Grid3x3,
} from "lucide-react"
import { useEffect, useState } from 'react';
import { APP_LOGO_PATH } from '@/lib/branding';
import { getLogoUrl } from '@/services/logo-service';
import { PwaInstallButton } from './pwa-install-button';
import { POS_FEATURE_TABLES } from '@/lib/pos-features';

export function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState(APP_LOGO_PATH);

  useEffect(() => {
    getLogoUrl().then(setLogoUrl);
  }, []);

  const handleLogout = () => {
    logout();
  };

  const menuItems = [
    { href: "/super-admin", icon: <LayoutDashboard />, text: "Dashboard" },
    { href: "/super-admin/products", icon: <Package />, text: "Product Management" },
    { href: "/super-admin/inventory-items", icon: <Archive />, text: "Inventory Items" },
    { href: "/super-admin/stores", icon: <Store />, text: "Store Management"},
    { href: "/super-admin/tables", icon: <Grid3x3 />, text: "Table / Floor plan", hidden: !POS_FEATURE_TABLES },
    { href: "/super-admin/categories", icon: <Shapes />, text: "Category Management"},
    { href: "/super-admin/user-management", icon: <Users />, text: "User Management" },
    { href: "/super-admin/data", icon: <DatabaseZap />, text: "System Settings" },
  ];

  return (
    <SidebarProvider persistOpen={false} defaultOpen>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border/50 p-4">
          <div className="flex flex-col items-center justify-center gap-3 max-md:items-start max-md:justify-start">
            <Image src={logoUrl} alt="El Rio logo" width={120} height={120} className="rounded-xl shadow-sm ring-1 ring-sidebar-border/40 transition-transform duration-300 hover:scale-[1.02]" />
            <div className="text-center max-md:w-full max-md:text-left">
                <p className="font-bold text-lg tracking-tight">Super Admin</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="py-3">
          <SidebarMenu>
            {menuItems.map((item) => {
              if ("hidden" in item && item.hidden) return null;
              const isActive =
                item.href === "/super-admin"
                  ? pathname === "/super-admin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link href={item.href} className="flex items-center gap-3">
                      {item.icon}
                      <span className="truncate">{item.text}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
           <div className="p-2 mt-auto">
              <Link
                href="/pos"
                className="group relative z-10 flex items-center justify-center gap-2 overflow-hidden rounded-full border-2 border-primary/50 bg-primary/10 px-4 py-2 text-lg font-semibold text-primary shadow-xl isolation-auto before:absolute before:-left-full before:-z-10 before:aspect-square before:w-full before:rounded-full before:bg-primary before:transition-all before:duration-700 before:hover:left-0 before:hover:w-full before:hover:scale-150 before:hover:duration-700 hover:text-primary-foreground max-md:justify-start"
              >
                POS Mode
                <LayoutGrid className="h-8 w-8 rotate-45 rounded-full border border-primary p-2 text-primary transition-transform duration-300 ease-linear group-hover:rotate-90 group-hover:border-none group-hover:bg-primary-foreground" />
              </Link>
            </div>
        </SidebarContent>
        <SidebarFooter>
          <Separator className="my-2" />
          <div className="p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start items-center gap-3 rounded-xl p-2.5 h-auto transition-colors duration-200 hover:bg-sidebar-accent">
                    <Avatar>
                      <AvatarImage src="https://placehold.co/40x40.png" alt="@user" data-ai-hint="user avatar" />
                      <AvatarFallback>{user?.fullName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">{user?.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user?.role}</p>
                    </div>
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                 <DropdownMenuItem asChild>
                  <Link href="/pos">
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    <span>POS Mode</span>
                  </Link>
                </DropdownMenuItem>
                 <DropdownMenuItem asChild>
                  <Link href="/settings/profile">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Manage Profile</span>
                  </Link>
                </DropdownMenuItem>
                <PwaInstallButton variant="menu-item" />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <SidebarMobileHeader title="Super Admin" />
        <main className="min-h-0 flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
