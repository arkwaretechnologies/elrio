"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Landmark,
  ShoppingBag,
  Package,
  BarChart3,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/context/auth-context";
import { canAccessPosRoute, type PermissionId } from "@/lib/types";

type BottomTab = {
  id: string;
  href?: string;
  label: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
  allowed: boolean;
  action?: "more";
};

function pathMatches(pathname: string, href: string) {
  if (href === "/pos") return pathname === "/pos";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PosBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { setOpenMobile } = useSidebar();

  if (!user) return null;

  const tabs: BottomTab[] = [
    {
      id: "pos",
      href: "/pos",
      label: "POS",
      icon: Landmark,
      match: (p) => p === "/pos",
      allowed: canAccessPosRoute(user.permissions, "register"),
    },
    {
      id: "orders",
      href: "/pos/orders",
      label: "Orders",
      icon: ShoppingBag,
      match: (p) => p.startsWith("/pos/orders"),
      allowed: canAccessPosRoute(user.permissions, "orders"),
    },
    {
      id: "inventory",
      href: "/inventory/inventory-items",
      label: "Inventory",
      icon: Package,
      match: (p) => p.startsWith("/inventory"),
      allowed: user.permissions.includes("inventory" as PermissionId),
    },
    {
      id: "reports",
      href: "/reports/order-history",
      label: "Reports",
      icon: BarChart3,
      match: (p) => p.startsWith("/reports"),
      allowed: user.permissions.includes("reports" as PermissionId),
    },
    {
      id: "more",
      label: "More",
      icon: MoreHorizontal,
      allowed: true,
      action: "more",
    },
  ];

  const visible = tabs.filter((t) => t.allowed);
  const moreActive =
    !visible.some(
      (t) => t.href && t.match?.(pathname),
    );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/90 lg:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
        {visible.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.action === "more"
              ? moreActive
              : Boolean(tab.match?.(pathname) || (tab.href && pathMatches(pathname, tab.href)));

          if (tab.action === "more") {
            return (
              <li key={tab.id} className="flex min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setOpenMobile(true)}
                  className={cn(
                    "flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="truncate">{tab.label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={tab.id} className="flex min-w-0 flex-1">
              <Link
                href={tab.href!}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
