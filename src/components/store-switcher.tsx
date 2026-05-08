
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Store as StoreIcon } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "./ui/skeleton"
import { useSidebar } from "@/components/ui/sidebar"

export function StoreSwitcher() {
  const [open, setOpen] = React.useState(false)
  const { stores, currentStore, setCurrentStore, loading: authLoading } = useAuth()
  const { state, isMobile } = useSidebar()
  const iconOnly = !isMobile && state === "collapsed"
  
  if (authLoading || !currentStore) {
    return (
      <Skeleton
        className={cn("h-10 w-full", iconOnly && "mx-auto size-12 shrink-0 rounded-xl")}
      />
    )
  }
  
  const selectedStore = stores.find(s => s.id === currentStore.id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={selectedStore?.name ? `Store: ${selectedStore.name}` : "Select a store"}
          className={cn(
            "gap-2",
            iconOnly
              ? "mx-auto size-12 shrink-0 items-center justify-center rounded-xl p-0"
              : "w-full justify-between"
          )}
        >
          <StoreIcon className={cn("h-4 w-4 shrink-0", !iconOnly && "mr-2")} />
          {!iconOnly && (
            <>
              <span className="truncate">{selectedStore?.name ?? "Select store..."}</span>
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          iconOnly
            ? "w-[min(18rem,calc(100vw-2rem))]"
            : "w-[--radix-popover-trigger-width]"
        )}
      >
        <Command>
          <CommandList>
            <CommandInput placeholder="Search store..." />
            <CommandEmpty>No store found.</CommandEmpty>
            <CommandGroup heading="Stores">
              {stores.map((store) => (
                <CommandItem
                  key={store.id}
                  onSelect={() => {
                    if (currentStore?.id !== store.id) {
                      setCurrentStore(store)
                    }
                    setOpen(false)
                  }}
                  className="text-sm"
                >
                  <StoreIcon className="mr-2 h-4 w-4" />
                  {store.name}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      currentStore?.id === store.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
