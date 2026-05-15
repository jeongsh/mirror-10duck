import { redirect } from "next/navigation";
import { getCurrentCours } from "@/lib/otaku/cours";

export const dynamic = "force-dynamic";

export default function CurrentSeasonPage() {
  const cours = getCurrentCours().toLowerCase();
  redirect(`/season/${cours}`);
}
