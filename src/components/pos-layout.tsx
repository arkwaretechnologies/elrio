
"use client"

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useCart } from "@/context/cart-context"
import { useAuth } from "@/context/auth-context"

import {
  Landmark,
  Package,
  BarChart3,
  Settings,
  Users,
  LogOut,
  ChevronDown,
  Shapes,
  Box,
  Archive,
  ClipboardList,
  AreaChart,
  Receipt,
  TrendingUp,
  DatabaseZap,
  Store,
  Shield,
  User as UserIcon,
  Clock,
  BookMarked,
  History,
  Sunset,
  Contact,
  PackageSearch,
  UtensilsCrossed,
  ShoppingBag,
  Printer,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from 'react';
import { APP_LOGO_PATH } from '@/lib/branding';
import { getLogoUrl } from '@/services/logo-service';
import { PwaInstallButton } from './pwa-install-button';
import { StoreSwitcher } from './store-switcher';
import { PosBottomNav } from './pos-bottom-nav';
import type { PermissionId } from '@/lib/types';
import { canAccessPosRoute } from '@/lib/types';

type PosMenuItem = {
  href: string;
  icon: ReactNode;
  text: string;
  permission: string;
  hidden?: boolean;
  subItems?: Array<{
    href: string;
    icon: ReactNode;
    text: string;
    hidden?: boolean;
  }>;
};

function hasTopLevelMenuPermission(
  user: NonNullable<ReturnType<typeof useAuth>["user"]>,
  item: PosMenuItem
): boolean {
  switch (item.permission) {
    case "pos":
      return canAccessPosRoute(user.permissions, "register");
    case "tables":
      return canAccessPosRoute(user.permissions, "tables");
    case "orders":
      return canAccessPosRoute(user.permissions, "orders");
    default:
      return user.permissions.includes(item.permission as PermissionId);
  }
}

function PosNavigationMenu({
  menuItems,
  user,
  pathname,
}: {
  menuItems: PosMenuItem[];
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  pathname: string;
}) {
  const { state, isMobile } = useSidebar();
  const submenusAsDropdown = !isMobile && state === "collapsed";

  return (
    <SidebarMenu>
      {menuItems.map((item) => {
        if ("hidden" in item && item.hidden) return null;
        if (!hasTopLevelMenuPermission(user, item)) {
          return null;
        }

        if (item.subItems) {
          if (submenusAsDropdown) {
            const links = item.subItems
              .filter((sub) => !("hidden" in sub && sub.hidden))
              .filter((sub) => {
                const subItemRequiresUserPerm = sub.href.includes("user-management");
                return (
                  user.permissions.includes(item.permission as never) &&
                  (!subItemRequiresUserPerm || user.permissions.includes("users" as never))
                );
              });

            if (links.length === 0) return null;

            return (
              <SidebarMenuItem key={item.href}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton tooltip={item.text}>
                      {item.icon}
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="min-w-[12rem]"
                    side="right"
                    align="start"
                    sideOffset={8}
                  >
                    {links.map((subItem) => (
                      <DropdownMenuItem key={subItem.href} asChild>
                        <Link
                          href={subItem.href}
                          className={pathname === subItem.href ? "bg-accent" : undefined}
                        >
                          {subItem.icon}
                          <span>{subItem.text}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible
              key={item.href}
              defaultOpen={pathname.startsWith(item.href)}
              className="group/collapsible"
            >
              <SidebarMenuItem className="w-full">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.text}>
                    {item.icon}
                    <span className="group-data-[state=collapsed]:hidden">
                      {item.text}
                    </span>
                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-70 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[state=collapsed]:hidden group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
              </SidebarMenuItem>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <SidebarMenuSub>
                  {item.subItems.map((subItem) => {
                    if ("hidden" in subItem && subItem.hidden) return null;
                    const subItemRequiresUserPerm =
                      subItem.href.includes("user-management");
                    const hasSubPermission =
                      user.permissions.includes(item.permission as never) &&
                      (!subItemRequiresUserPerm ||
                        user.permissions.includes("users" as never));

                    if (!hasSubPermission) return null;

                    return (
                      <SidebarMenuSubItem key={subItem.href}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === subItem.href}
                        >
                          <Link href={subItem.href}>
                            {subItem.icon}
                            <span className="group-data-[state=collapsed]:hidden">
                              {subItem.text}
                            </span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          );
        }

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              tooltip={item.text}
            >
              <Link href={item.href}>
                {item.icon}
                <span className="group-data-[state=collapsed]:hidden">
                  {item.text}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function CloseMobileNavOnNavigate() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  return null;
}

export function PosLayout({ children }: { children: React.ReactNode }) {
  const { clearCart } = useCart()
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState(APP_LOGO_PATH);

  useEffect(() => {
    getLogoUrl().then(setLogoUrl);
  }, []);

  const handleLogout = () => {
    logout();
    clearCart();
  };

  const menuItems = [
    { href: "/pos", icon: <Landmark />, text: "Point of Sale", permission: 'pos' },
    { href: "/pos/tables", icon: <UtensilsCrossed />, text: "Tables", permission: 'tables', hidden: true },
    { href: "/pos/orders", icon: <ShoppingBag />, text: "Orders", permission: 'orders' },
    {
      href: "/inventory",
      icon: <Package />,
      text: "Inventory",
      permission: 'inventory',
      subItems: [
        { href: "/inventory/inventory-items", icon: <Archive />, text: "Inventory Items" },
      ]
    },
    { href: "/expenses", icon: <Receipt />, text: "Expenses", permission: 'expenses' },
    {
      href: "/crm",
      icon: <Contact />,
      text: "CRM",
      permission: 'crm',
      hidden: true,
      subItems: [
        { href: "/crm/customers", icon: <Users />, text: "Regular Customers" },
      ]
    },
    { href: "/pre-orders", icon: <BookMarked />, text: "Pre-orders", permission: 'preorders', hidden: true },
    {
      href: "/reports",
      icon: <BarChart3 />,
      text: "Reports",
      permission: 'reports',
      subItems: [
        { href: "/reports/order-history", icon: <History />, text: "Order History" },
        { href: "/reports/pre-orders", icon: <BookMarked />, text: "Pre-orders Report", hidden: true },
        { href: "/reports/sales", icon: <AreaChart />, text: "Sales Report" },
        { href: "/reports/peak-hours", icon: <Clock />, text: "Peak Hours" },
        { href: "/reports/stock-movement", icon: <TrendingUp />, text: "Stock Movement" },
        { href: "/reports/inventory-consumption", icon: <PackageSearch />, text: "Inv. Consumption" },
        { href: "/reports/products", icon: <Package />, text: "Product List" },
        { href: "/reports", icon: <ClipboardList />, text: "Inventory Logs" },
      ]
    },
    {
      href: "/settings",
      icon: <Settings />,
      text: "Settings",
      permission: 'settings',
      subItems: [
        { href: "/settings/user-management", icon: <Users />, text: "User Management" },
        { href: "/settings/printers", icon: <Printer />, text: "Printers" },
        { href: "/settings/end-of-day", icon: <Sunset />, text: "End of Day" },
      ]
    },
  ] satisfies PosMenuItem[];

  const isAdminOrOwner = user?.role === 'Admin' || user?.role === 'Owner';
  const sidebarDefaultOpen = !pathname.startsWith("/pos");

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <CloseMobileNavOnNavigate />
      <Sidebar collapsible="icon">
        <SidebarRail />
        <SidebarHeader className="relative border-b border-sidebar-border/50 p-4">
          <div className="flex justify-center">
             <Image src={logoUrl} alt="El Rio logo" width={120} height={120} className="rounded-xl shadow-sm ring-1 ring-sidebar-border/40 transition-transform duration-300 ease-out group-data-[state=collapsed]:hidden hover:scale-[1.02]" />
              <Image src={logoUrl} alt="El Rio logo" width={48} height={48} className="rounded-xl shadow-sm ring-1 ring-sidebar-border/40 transition-transform duration-300 ease-out group-data-[state=expanded]:hidden hover:scale-105" />
          </div>
        </SidebarHeader>
        <SidebarContent className="py-3">
          <div className="flex justify-center px-2 pb-2 group-data-[collapsible=icon]:px-1">
            <StoreSwitcher />
          </div>
          {user ? (
            <PosNavigationMenu
              menuItems={menuItems}
              user={user}
              pathname={pathname}
            />
          ) : null}
        </SidebarContent>
        <SidebarFooter>
           <div className="p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start items-center gap-3 rounded-xl p-2.5 h-auto transition-colors duration-200 hover:bg-sidebar-accent group-data-[state=collapsed]:justify-center">
                    <Avatar>
                      <AvatarImage src="https://placehold.co/40x40.png" alt="@user" data-ai-hint="user avatar" />
                      <AvatarFallback>{user?.fullName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left group-data-[state=collapsed]:hidden">
                      <p className="font-semibold text-sm">{user?.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user?.role}</p>
                    </div>
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {isAdminOrOwner && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/super-admin">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Mode</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
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
           <Separator className="my-1 group-data-[state=collapsed]:hidden" />
           <div className="group-data-[state=collapsed]:hidden p-2">
             <SidebarTrigger title="Collapse sidebar" />
           </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <main className="min-h-0 flex-1 overflow-y-auto bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </main>
        </div>
        <PosBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
