"use client";

import { useEffect, useState } from "react";

/** Elapsed whole minutes since `since`, re-checking every minute. */
export function QueueMinutes({ since }: { since: Date }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  void tick;
  const mins = Math.max(0, Math.floor((Date.now() - since.getTime()) / 60_000));
  return <span className="tabular-nums text-muted-foreground">{mins}m</span>;
}
