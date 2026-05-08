"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { getStores, getStore, updateStore } from "@/services/store-service";
import {
  FLOOR_PLAN_TABLE_DEFAULT_HEIGHT_PCT,
  FLOOR_PLAN_TABLE_DEFAULT_WIDTH_PCT,
  floorPlanTableSize,
  type FloorPlanTable,
  type Store,
} from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CakeLoader } from "@/components/cake-loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, GripVertical } from "lucide-react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function defaultGridPositions(count: number): { xPct: number; yPct: number }[] {
  if (count <= 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const out: { xPct: number; yPct: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const xPct = ((col + 0.5) / cols) * 100;
    const yPct = ((row + 0.5) / rows) * 100;
    out.push({ xPct, yPct });
  }
  return out;
}

function newTableAt(index: number, totalAfterAdd: number): FloorPlanTable {
  const grid = defaultGridPositions(totalAfterAdd);
  const pos = grid[index] ?? { xPct: 50, yPct: 50 };
  return {
    id: crypto.randomUUID(),
    label: String(index + 1),
    xPct: pos.xPct,
    yPct: pos.yPct,
    widthPct: FLOOR_PLAN_TABLE_DEFAULT_WIDTH_PCT,
    heightPct: FLOOR_PLAN_TABLE_DEFAULT_HEIGHT_PCT,
  };
}

const RESIZE_MIN_PCT = 5;
const RESIZE_MAX_PCT = 48;

function DraggableTableChip({
  table,
  canvasRef,
  onEditClick,
  onResize,
}: {
  table: FloorPlanTable;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onEditClick: (t: FloorPlanTable) => void;
  onResize: (id: string, widthPct: number, heightPct: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: table.id,
  });

  const { widthPct, heightPct } = floorPlanTableSize(table);

  const style: React.CSSProperties = {
    position: "absolute",
    left: `${table.xPct}%`,
    top: `${table.yPct}%`,
    width: `${widthPct}%`,
    height: `${heightPct}%`,
    minWidth: 72,
    minHeight: 44,
    boxSizing: "border-box",
    transform: transform
      ? `translate(-50%, -50%) translate3d(${transform.x}px, ${transform.y}px, 0)`
      : "translate(-50%, -50%)",
    touchAction: "none",
    zIndex: isDragging ? 20 : 10,
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const startW = widthPct;
    const startH = heightPct;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      const nw = clamp(startW + (dx / rect.width) * 100, RESIZE_MIN_PCT, RESIZE_MAX_PCT);
      const nh = clamp(startH + (dy / rect.height) * 100, RESIZE_MIN_PCT, RESIZE_MAX_PCT);
      onResize(table.id, nw, nh);
    };

    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex flex-col overflow-hidden rounded-lg border-2 border-primary bg-card shadow-md ring-offset-background"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center gap-1 px-1 py-0.5">
        <button
          type="button"
          className="cursor-grab shrink-0 touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label={`Drag table ${table.label}`}
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </button>
        <span className="truncate text-center text-sm font-semibold leading-tight">{table.label}</span>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={(ev) => {
            ev.stopPropagation();
            onEditClick(table);
          }}
          aria-label={`Edit label for table ${table.label}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        type="button"
        aria-label={`Resize table ${table.label}`}
        className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize rounded-tl border border-primary/40 bg-primary/15 hover:bg-primary/25 touch-none"
        onPointerDown={onResizePointerDown}
      />
    </div>
  );
}

export function TableManagementClient() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [workingTables, setWorkingTables] = useState<FloorPlanTable[]>([]);
  const [loadingFloor, setLoadingFloor] = useState(false);
  const [countInput, setCountInput] = useState<string>("0");
  const [pendingReduce, setPendingReduce] = useState<number | null>(null);
  const [editTable, setEditTable] = useState<FloorPlanTable | null>(null);
  const [editLabelDraft, setEditLabelDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    getStores().then((list) => {
      setStores(list);
      setLoadingStores(false);
    });
  }, []);

  const handleStoreSelect = (storeId: string) => {
    setSelectedStoreId(storeId);
    if (!storeId) {
      setWorkingTables([]);
      setCountInput("0");
      return;
    }
    setLoadingFloor(true);
    getStore(storeId)
      .then((s) => {
        const tables = s?.floorPlanTables ? [...s.floorPlanTables] : [];
        setWorkingTables(tables);
        setCountInput(String(tables.length));
      })
      .finally(() => setLoadingFloor(false));
  };

  const applyTableCount = (nextCount: number) => {
    const n = clamp(Math.round(nextCount), 0, 99);
    const current = workingTables.length;
    if (n === current) {
      setCountInput(String(n));
      return;
    }
    if (n > current) {
      setWorkingTables((prev) => {
        const added: FloorPlanTable[] = [];
        for (let i = current; i < n; i++) {
          added.push(newTableAt(i, n));
        }
        return [...prev, ...added];
      });
      setCountInput(String(n));
      return;
    }
    setPendingReduce(n);
  };

  const confirmReduce = () => {
    if (pendingReduce === null) return;
    setWorkingTables((prev) => prev.slice(0, pendingReduce));
    setCountInput(String(pendingReduce));
    setPendingReduce(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const el = canvasRef.current;
    if (!el || !delta.x && !delta.y) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const id = String(active.id);
    const dxPct = (delta.x / rect.width) * 100;
    const dyPct = (delta.y / rect.height) * 100;
    setWorkingTables((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              xPct: clamp(t.xPct + dxPct, 0, 100),
              yPct: clamp(t.yPct + dyPct, 0, 100),
            }
          : t,
      ),
    );
  };

  const handleTableResize = (id: string, widthPct: number, heightPct: number) => {
    setWorkingTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, widthPct, heightPct } : t)),
    );
  };

  const handleResetLayout = () => {
    setWorkingTables((prev) => {
      if (prev.length === 0) return prev;
      const grid = defaultGridPositions(prev.length);
      return prev.map((t, i) => ({
        ...t,
        xPct: grid[i]?.xPct ?? 50,
        yPct: grid[i]?.yPct ?? 50,
      }));
    });
    toast({ title: "Layout reset", description: "Tables arranged on a default grid (not saved yet)." });
  };

  const handleSave = async () => {
    if (!selectedStoreId) return;
    setSaving(true);
    try {
      await updateStore(selectedStoreId, { floorPlanTables: workingTables });
      toast({ title: "Saved", description: "Floor plan updated for this store." });
    } catch {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Could not update the store.",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditLabel = (t: FloorPlanTable) => {
    setEditTable(t);
    setEditLabelDraft(t.label);
  };

  const commitEditLabel = () => {
    if (!editTable) return;
    const trimmed = editLabelDraft.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "Label required", description: "Enter a non-empty label." });
      return;
    }
    setWorkingTables((prev) =>
      prev.map((t) => (t.id === editTable.id ? { ...t, label: trimmed } : t)),
    );
    setEditTable(null);
  };

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Table / floor plan</h1>
          <p className="text-muted-foreground">
            Set how many tables each store has, drag them to match the layout, then save. POS staff only view and select tables.
          </p>
        </div>
        <div className="w-full sm:w-72">
          {loadingStores ? (
            <CakeLoader />
          ) : (
            <Select value={selectedStoreId} onValueChange={handleStoreSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a store…" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!selectedStoreId ? (
        <p className="text-muted-foreground">Choose a store to edit its floor plan.</p>
      ) : loadingFloor ? (
        <div className="flex justify-center py-16">
          <CakeLoader />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="table-count">Number of tables</Label>
                  <Input
                    id="table-count"
                    type="number"
                    min={0}
                    max={99}
                    className="w-32"
                    value={countInput}
                    onChange={(e) => setCountInput(e.target.value)}
                    onBlur={() => {
                      const v = parseInt(countInput, 10);
                      if (Number.isNaN(v)) {
                        setCountInput(String(workingTables.length));
                        return;
                      }
                      applyTableCount(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseInt(countInput, 10);
                        if (!Number.isNaN(v)) applyTableCount(v);
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={handleResetLayout} disabled={workingTables.length === 0}>
                  Reset layout to grid
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save floor plan"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Store: <span className="font-medium text-foreground">{selectedStore?.name}</span>. Drag the grip to move;
                drag the bottom-right corner of a table to resize; pencil edits the label. Reducing table count removes tables
                from the end of the list; past sales still keep their recorded table name.
              </p>
            </CardContent>
          </Card>

          <DndContext
            sensors={sensors}
            modifiers={[restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={canvasRef}
              className="relative mx-auto min-h-[420px] w-full max-w-4xl overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30"
            >
              {workingTables.length === 0 ? (
                <div className="flex h-[420px] items-center justify-center text-muted-foreground">
                  No tables — set the number above and press Enter or blur the field.
                </div>
              ) : (
                workingTables.map((t) => (
                  <DraggableTableChip
                    key={t.id}
                    table={t}
                    canvasRef={canvasRef}
                    onEditClick={openEditLabel}
                    onResize={handleTableResize}
                  />
                ))
              )}
            </div>
          </DndContext>
        </>
      )}

      <AlertDialog
        open={pendingReduce !== null}
        onOpenChange={(o) => {
          if (!o && pendingReduce !== null) {
            setPendingReduce(null);
            setCountInput(String(workingTables.length));
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tables?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {workingTables.length - (pendingReduce ?? 0)} table
              {workingTables.length - (pendingReduce ?? 0) === 1 ? "" : "s"} from the end of the list. Sales already
              completed still show the table name that was stored on the receipt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReduce}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTable} onOpenChange={(o) => !o && setEditTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Table label</DialogTitle>
          </DialogHeader>
          <Input
            value={editLabelDraft}
            onChange={(e) => setEditLabelDraft(e.target.value)}
            placeholder="e.g. 1, VIP, Patio A"
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTable(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={commitEditLabel}>
              Save label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
