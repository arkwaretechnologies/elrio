import { redirect } from "next/navigation";
import { POS_FEATURE_TABLES } from "@/lib/pos-features";

export default function PosTablesPage() {
  if (!POS_FEATURE_TABLES) {
    redirect("/pos");
  }
  return null;
}
